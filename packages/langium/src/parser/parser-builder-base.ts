/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EMPTY_ALT, IOrAlt, TokenType, TokenTypeDictionary } from 'chevrotain';
import { AbstractElement, Action, Alternatives, Condition, CrossReference, Grammar, Group, isAction, isAlternatives, isAssignment, isConjunction, isCrossReference, isDisjunction, isGroup, isKeyword, isLiteralCondition, isNegation, isParameterReference, isParserRule, isRuleCall, isTerminalRule, isUnorderedGroup, Keyword, NamedArgument, ParserRule, RuleCall, UnorderedGroup } from '../grammar/generated/ast';
import { BaseParser } from './langium-parser';
import { AstNode } from '../syntax-tree';
import { assertUnreachable, ErrorWithLocation } from '../utils/errors';
import { stream } from '../utils/stream';
import { Cardinality, getTypeName } from '../grammar/internal-grammar-util';
import { findNameAssignment, getAllReachableRules } from '../utils/grammar-util';

type RuleContext = {
    optional: number,
    consume: number,
    subrule: number,
    many: number,
    or: number
} & ParserContext;

type ParserContext = {
    parser: BaseParser
    tokens: TokenTypeDictionary
    rules: Map<string, Rule>
    ruleNames: Map<AstNode, string>
}

type Rule = () => unknown;

type Args = Record<string, boolean>;

type Predicate = (args: Args) => boolean;

type Method = (args: Args) => void;

export function createParser<T extends BaseParser>(grammar: Grammar, parser: T, tokens: TokenTypeDictionary): T {
    const rules = new Map<string, Rule>();
    const parserContext: ParserContext = {
        parser,
        tokens,
        rules,
        ruleNames: new Map()
    };
    buildRules(parserContext, grammar);
    return parser;
}

function buildRules(parserContext: ParserContext, grammar: Grammar): void {
    const reachable = getAllReachableRules(grammar, false);
    const parserRules = stream(grammar.rules).filter(isParserRule).filter(rule => reachable.has(rule));
    for (const rule of parserRules) {
        const ctx: RuleContext = {
            ...parserContext,
            consume: 1,
            optional: 1,
            subrule: 1,
            many: 1,
            or: 1
        };
        ctx.rules.set(
            rule.name,
            parserContext.parser.rule(rule, buildElement(ctx, rule.definition))
        );
    }
}

function buildElement(ctx: RuleContext, element: AbstractElement, ignoreGuard = false): Method {
    let method: Method;
    if (isKeyword(element)) {
        method = buildKeyword(ctx, element);
    } else if (isAction(element)) {
        method = buildAction(ctx, element);
    } else if (isAssignment(element)) {
        method = buildElement(ctx, element.terminal);
    } else if (isCrossReference(element)) {
        method = buildCrossReference(ctx, element);
    } else if (isRuleCall(element)) {
        method = buildRuleCall(ctx, element);
    } else if (isAlternatives(element)) {
        method = buildAlternatives(ctx, element);
    } else if (isUnorderedGroup(element)) {
        method = buildUnorderedGroup(ctx, element);
    } else if (isGroup(element)) {
        method = buildGroup(ctx, element);
    } else {
        throw new ErrorWithLocation(element.$cstNode, `Unexpected element type: ${element.$type}`);
    }
    return wrap(ctx, ignoreGuard ? undefined : getGuardCondition(element), method, element.cardinality);
}

function buildAction(ctx: RuleContext, action: Action): Method {
    const actionType = getTypeName(action);
    return () => ctx.parser.action(actionType, action);
}

function buildRuleCall(ctx: RuleContext, ruleCall: RuleCall): Method {
    const rule = ruleCall.rule.ref;
    if (isParserRule(rule)) {
        const idx = ctx.subrule++;
        const predicate = ruleCall.arguments.length > 0 ? buildRuleCallPredicate(rule, ruleCall.arguments) : () => ({});
        return (args) => ctx.parser.subrule(idx, getRule(ctx, rule), ruleCall, predicate(args));
    } else if (isTerminalRule(rule)) {
        const idx = ctx.consume++;
        const method = getToken(ctx, rule.name);
        return () => ctx.parser.consume(idx, method, ruleCall);
    } else if (!rule) {
        throw new ErrorWithLocation(ruleCall.$cstNode, `Undefined rule type: ${ruleCall.$type}`);
    } else {
        assertUnreachable(rule);
    }
}

function buildRuleCallPredicate(rule: ParserRule, namedArgs: NamedArgument[]): (args: Args) => Args {
    const predicates = namedArgs.map(e => buildPredicate(e.value));
    return (args) => {
        const ruleArgs: Args = {};
        for (let i = 0; i < predicates.length; i++) {
            const ruleTarget = rule.parameters[i];
            const predicate = predicates[i];
            ruleArgs[ruleTarget.name] = predicate(args);
        }
        return ruleArgs;
    };
}

interface PredicatedMethod {
    ALT: Method,
    GATE?: Predicate
}

function buildPredicate(condition: Condition): Predicate {
    if (isDisjunction(condition)) {
        const left = buildPredicate(condition.left);
        const right = buildPredicate(condition.right);
        return (args) => (left(args) || right(args));
    } else if (isConjunction(condition)) {
        const left = buildPredicate(condition.left);
        const right = buildPredicate(condition.right);
        return (args) => (left(args) && right(args));
    } else if (isNegation(condition)) {
        const value = buildPredicate(condition.value);
        return (args) => !value(args);
    } else if (isParameterReference(condition)) {
        const name = condition.parameter.ref!.name;
        return (args) => args !== undefined && args[name] === true;
    } else if (isLiteralCondition(condition)) {
        const value = !!condition.true;
        return () => value;
    }
    assertUnreachable(condition);
}

function buildAlternatives(ctx: RuleContext, alternatives: Alternatives): Method {
    if (alternatives.elements.length === 1) {
        return buildElement(ctx, alternatives.elements[0]);
    } else {
        const methods: PredicatedMethod[] = [];

        for (const element of alternatives.elements) {
            const predicatedMethod: PredicatedMethod = {
                // Since we handle the guard condition in the alternative already
                // We can ignore the group guard condition inside
                ALT: buildElement(ctx, element, true)
            };
            const guard = getGuardCondition(element);
            if (guard) {
                predicatedMethod.GATE = buildPredicate(guard);
            }
            methods.push(predicatedMethod);
        }

        const idx = ctx.or++;
        return (args) => ctx.parser.alternatives(idx, methods.map(method => {
            const alt: IOrAlt<unknown> = {
                ALT: () => method.ALT(args)
            };
            const gate = method.GATE;
            if (gate) {
                alt.GATE = () => gate(args);
            }
            return alt;
        }));
    }
}

function buildUnorderedGroup(ctx: RuleContext, group: UnorderedGroup): Method {
    if (group.elements.length === 1) {
        return buildElement(ctx, group.elements[0]);
    }
    const methods: PredicatedMethod[] = [];

    for (const element of group.elements) {
        const predicatedMethod: PredicatedMethod = {
            // Since we handle the guard condition in the alternative already
            // We can ignore the group guard condition inside
            ALT: buildElement(ctx, element, true)
        };
        const guard = getGuardCondition(element);
        if (guard) {
            predicatedMethod.GATE = buildPredicate(guard);
        }
        methods.push(predicatedMethod);
    }

    const orIdx = ctx.or++;

    const idFunc = (groupIdx: number, lParser: BaseParser) => {
        const stackId = lParser.getRuleStack().join('-');
        return `uGroup_${groupIdx}_${stackId}`;
    };
    const alternatives: Method = (args) => ctx.parser.alternatives(orIdx, methods.map((method, idx) => {
        const alt: IOrAlt<unknown> = { ALT: () => true };
        const parser = ctx.parser;
        alt.ALT = () => {
            method.ALT(args);
            if (!parser.isRecording()) {
                const key = idFunc(orIdx, parser);
                if (!parser.unorderedGroups.get(key)) {
                    // init after clear state
                    parser.unorderedGroups.set(key, []);
                }
                const groupState = parser.unorderedGroups.get(key)!;
                if (typeof groupState?.[idx] === 'undefined') {
                    // Not accessed yet
                    groupState[idx] = true;
                }
            }
        };
        const gate = method.GATE;
        if (gate) {
            alt.GATE = () => gate(args);
        } else {
            alt.GATE = () => {
                const trackedAlternatives = parser.unorderedGroups.get(idFunc(orIdx, parser));
                const allow = !trackedAlternatives?.[idx];
                return allow;
            };
        }
        return alt;
    }));
    const wrapped = wrap(ctx, getGuardCondition(group), alternatives, '*');
    return (args) => {
        wrapped(args);
        if (!ctx.parser.isRecording()) {
            ctx.parser.unorderedGroups.delete(idFunc(orIdx, ctx.parser));
        }
    };
}

function buildGroup(ctx: RuleContext, group: Group): Method {
    const methods = group.elements.map(e => buildElement(ctx, e));
    return (args) => methods.forEach(method => method(args));
}

function getGuardCondition(element: AbstractElement): Condition | undefined {
    if (isGroup(element)) {
        return element.guardCondition;
    }
    return undefined;
}

function buildCrossReference(ctx: RuleContext, crossRef: CrossReference, terminal = crossRef.terminal): Method {
    if (!terminal) {
        if (!crossRef.type.ref) {
            throw new Error('Could not resolve reference to type: ' + crossRef.type.$refText);
        }
        const assignment = findNameAssignment(crossRef.type.ref);
        const assignTerminal = assignment?.terminal;
        if (!assignTerminal) {
            throw new Error('Could not find name assignment for type: ' + getTypeName(crossRef.type.ref));
        }
        return buildCrossReference(ctx, crossRef, assignTerminal);
    } else if (isRuleCall(terminal) && isParserRule(terminal.rule.ref)) {
        const idx = ctx.subrule++;
        return (args) => ctx.parser.subrule(idx, getRule(ctx, terminal.rule.ref as ParserRule), crossRef, args);
    } else if (isRuleCall(terminal) && isTerminalRule(terminal.rule.ref)) {
        const idx = ctx.consume++;
        const terminalRule = getToken(ctx, terminal.rule.ref.name);
        return () => ctx.parser.consume(idx, terminalRule, crossRef);
    } else if (isKeyword(terminal)) {
        const idx = ctx.consume++;
        const keyword = getToken(ctx, terminal.value);
        return () => ctx.parser.consume(idx, keyword, crossRef);
    }
    else {
        throw new Error('Could not build cross reference parser');
    }
}

function buildKeyword(ctx: RuleContext, keyword: Keyword): Method {
    const idx = ctx.consume++;
    const token = ctx.tokens[keyword.value];
    if (!token) {
        throw new Error('Could not find token for keyword: ' + keyword.value);
    }
    return () => ctx.parser.consume(idx, token, keyword);
}

function wrap(ctx: RuleContext, guard: Condition | undefined, method: Method, cardinality: Cardinality): Method {
    const gate = guard && buildPredicate(guard);

    if (!cardinality) {
        if (gate) {
            const idx = ctx.or++;
            return (args) => ctx.parser.alternatives(idx, [
                {
                    ALT: () => method(args),
                    GATE: () => gate(args)
                },
                {
                    ALT: EMPTY_ALT(),
                    GATE: () => !gate(args)
                }
            ]);
        } else {
            return method;
        }
    }

    if (cardinality === '*') {
        const idx = ctx.many++;
        return (args) => ctx.parser.many(idx, {
            DEF: () => method(args),
            GATE: gate ? () => gate(args) : undefined
        });
    } else if (cardinality === '+') {
        const idx = ctx.many++;
        if (gate) {
            const orIdx = ctx.or++;
            // In the case of a guard condition for the `+` group
            // We combine it with an empty alternative
            // If the condition returns true, it needs to parse at least a single iteration
            // If its false, it is not allowed to parse anything
            return (args) => ctx.parser.alternatives(orIdx, [
                {
                    ALT: () => ctx.parser.atLeastOne(idx, {
                        DEF: () => method(args)
                    }),
                    GATE: () => gate(args)
                },
                {
                    ALT: EMPTY_ALT(),
                    GATE: () => !gate(args)
                }
            ]);
        } else {
            return (args) => ctx.parser.atLeastOne(idx, {
                DEF: () => method(args),
            });
        }
    } else if (cardinality === '?') {
        const idx = ctx.optional++;
        return (args) => ctx.parser.optional(idx, {
            DEF: () => method(args),
            GATE: gate ? () => gate(args) : undefined
        });
    } else {
        assertUnreachable(cardinality);
    }
}

function getRule(ctx: ParserContext, element: ParserRule | AbstractElement): Rule {
    const name = getRuleName(ctx, element);
    const rule = ctx.rules.get(name);
    if (!rule) throw new Error(`Rule "${name}" not found."`);
    return rule;
}

function getRuleName(ctx: ParserContext, element: ParserRule | AbstractElement): string {
    if (isParserRule(element)) {
        return element.name;
    } else if (ctx.ruleNames.has(element)) {
        return ctx.ruleNames.get(element)!;
    } else {
        let item: AstNode = element;
        let parent: AstNode = item.$container!;
        let ruleName = element.$type;
        while (!isParserRule(parent)) {
            if (isGroup(parent) || isAlternatives(parent) || isUnorderedGroup(parent)) {
                const index = parent.elements.indexOf(item as AbstractElement);
                ruleName = index.toString() + ':' + ruleName;
            }
            item = parent;
            parent = parent.$container!;
        }
        const rule = parent as ParserRule;
        ruleName = rule.name + ':' + ruleName;
        ctx.ruleNames.set(element, ruleName);
        return ruleName;
    }
}

function getToken(ctx: ParserContext, name: string): TokenType {
    const token = ctx.tokens[name];
    if (!token) throw new Error(`Token "${name}" not found."`);
    return token;
}
