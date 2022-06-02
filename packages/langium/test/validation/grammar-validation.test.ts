/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src';
import { Assignment, CrossReference, Grammar, Group, ParserRule } from '../../src/grammar/generated/ast';
import { expectError, expectNoIssues, expectWarning, validationHelper, ValidationResult } from '../../src/test';

const services = createLangiumGrammarServices();
const validate = validationHelper<Grammar>(services.grammar);

describe('checkReferenceToRuleButNotType', () => {

    const input = `
        grammar CrossRefs

        entry Model:
            'model' name=ID
            (elements+=Element)*;
        
        type AbstractElement = Reference | string;
        
        Element:
            Definition | Reference;
        
        Definition infers DefType:
            name=ID;
        Reference infers RefType:
            ref=[Definition];
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<Grammar>;

    beforeAll(async () => {
        validationResult = await validate(input);
    });

    test('CrossReference validation', () => {
        const rule = ((validationResult.document.parseResult.value.rules[3] as ParserRule).alternatives as Assignment).terminal as CrossReference;
        expectError(validationResult, "Use the rule type 'DefType' instead of the typed rule name 'Definition' for cross references.", {
            node: rule,
            property: { name: 'type' }
        });
    });

    test('AtomType validation', () => {
        const type = validationResult.document.parseResult.value.types[0];
        expectError(validationResult, "Use the rule type 'RefType' instead of the typed rule name 'Reference' for cross references.", {
            node: type,
            property: { name: 'typeAlternatives' }
        });
    });

});

describe('Check Rule Fragment Validation', () => {
    const grammar = `
    grammar g
    type Type = Fragment;
    fragment Fragment: name=ID;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<Grammar>;

    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('Rule Fragment Validation', () => {
        const fragmentType = validationResult.document.parseResult.value.types[0];
        expectError(validationResult, 'Cannot use rule fragments in types.', { node: fragmentType, property: { name: 'typeAlternatives' } });
    });
});

describe('Checked Named CrossRefs', () => {
    const input = `
    grammar g
    A: 'a' name=ID;
    B: 'b' name=[A];
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<Grammar>;

    beforeAll(async () => {
        validationResult = await validate(input);
    });

    test('Named crossReference warning', () => {
        const rule = ((validationResult.document.parseResult.value.rules[1] as ParserRule).alternatives as Group).elements[1] as Assignment;
        expectWarning(validationResult, 'The "name" property is not recommended for cross-references.', {
            node: rule,
            property: { name: 'feature' }
        });
    });
});

describe('Check grammar with primitives', () => {
    const grammar = `
    grammar PrimGrammar
    entry Expr:
        (String | Bool | Num | BigInt | DateObj)*;
    String:
        'String' val=STR;
    Bool:
        'Bool' val?='true';
    Num:
        'Num' val=NUM;
    BigInt:
        'BigInt' val=BIG 'n';
    DateObj:
        'Date' val=DATE;
    terminal STR: /[_a-zA-Z][\\w_]*/;
    terminal BIG returns bigint: /[0-9]+(?=n)/;
    terminal NUM returns number: /[0-9]+(\\.[0-9])?/;
    terminal DATE returns Date: /[0-9]{4}-{0-9}2-{0-9}2/+;
    `.trim();

    let validationResult: ValidationResult<Grammar>;

    // 1. build a parser from this grammar, verify it works
    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('No validation errors in grammar', () => {
        expectNoIssues(validationResult);
    });
});

describe('Structural property validation of declared types', () => {

    const grammar = `
    grammar StructuralGrammar
    
    interface Base {
        name: string;
    }

    interface Extends extends Base {
        count: number;
    }

    entry Main: ValidBaseUse | InvalidBaseUse | InvalidExtendsUse | ValidExtendsUse;

    ValidBaseUse returns Base: name=ID;
    InvalidBaseUse returns Base: name=NUM;
    InvalidExtendsUse returns Extends: name=ID;
    ValidExtendsUse returns Extends: name=ID count=NUM;

    terminal ID: '';
    terminal NUM returns number: '';
    `;

    let validationResult: ValidationResult<Grammar>;

    // 1. build a parser from this grammar, verify it works
    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('No validation errors on `ValidBaseUse`', () => {
        const validBaseUse = validationResult.document.parseResult.value.rules[1];
        expectNoIssues(validationResult, {
            node: validBaseUse,
            property: { name: 'name' }
        });
    });

    test('No validation errors on `ValidExtendsUse`', () => {
        const validExtendsUse = validationResult.document.parseResult.value.rules[4];
        expectNoIssues(validationResult, {
            node: validExtendsUse,
            property: { name: 'name' }
        });
    });

    test('Validation error on `InvalidBaseUse`', () => {
        const invalidBaseUse = validationResult.document.parseResult.value.rules[2] as ParserRule;
        const nameAssignment = invalidBaseUse.alternatives as Assignment;
        expectError(validationResult, "The assigned type 'number' is not compatible with the declared property 'name' of type 'string'.", {
            node: nameAssignment,
            property: { name: 'feature' }
        });
    });

});

describe('Extending existing interfaces', () => {

    const grammar = `
    grammar StructuralGrammar
    
    interface ValidBase {
        name: string;
    }

    interface ValidExtends extends ValidBase {
        count: number;
    }

    interface InvalidExtends extends ValidBase {
        name: string; // Cannot redeclare properties
    }

    interface ValidBase2 {
        name: number;
    }

    interface InvalidBaseMerge extends ValidBase, ValidBase2 {
        // Cannot merge both of the 'name' properties
    }

    entry Test: name=ID;
    terminal ID: '';
    `;

    let validationResult: ValidationResult<Grammar>;

    // 1. build a parser from this grammar, verify it works
    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('No validation errors in grammar', () => {
        expectNoIssues(validationResult);
    });

});
