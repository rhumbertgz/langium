/******************************************************************************
 * This file was generated by langium-cli 0.4.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-empty-interface */
import { AstNode, AstReflection, Reference, isAstNode, TypeMetaData } from 'langium';

export interface Command extends AstNode {
    readonly $container: Statemachine;
    name: string
}

export const Command = 'Command';

export function isCommand(item: unknown): item is Command {
    return reflection.isInstance(item, Command);
}

export interface Event extends AstNode {
    readonly $container: Statemachine;
    name: string
}

export const Event = 'Event';

export function isEvent(item: unknown): item is Event {
    return reflection.isInstance(item, Event);
}

export interface State extends AstNode {
    readonly $container: Statemachine;
    actions: Array<Reference<Command>>
    name: string
    transitions: Array<Transition>
}

export const State = 'State';

export function isState(item: unknown): item is State {
    return reflection.isInstance(item, State);
}

export interface Statemachine extends AstNode {
    commands: Array<Command>
    events: Array<Event>
    init: Reference<State>
    name: string
    states: Array<State>
}

export const Statemachine = 'Statemachine';

export function isStatemachine(item: unknown): item is Statemachine {
    return reflection.isInstance(item, Statemachine);
}

export interface Transition extends AstNode {
    readonly $container: State;
    event: Reference<Event>
    state: Reference<State>
}

export const Transition = 'Transition';

export function isTransition(item: unknown): item is Transition {
    return reflection.isInstance(item, Transition);
}

export type StatemachineAstType = 'Command' | 'Event' | 'State' | 'Statemachine' | 'Transition';

export class StatemachineAstReflection implements AstReflection {

    getAllTypes(): string[] {
        return ['Command', 'Event', 'State', 'Statemachine', 'Transition'];
    }

    isInstance(node: unknown, type: string): boolean {
        return isAstNode(node) && this.isSubtype(node.$type, type);
    }

    isSubtype(subtype: string, supertype: string): boolean {
        if (subtype === supertype) {
            return true;
        }
        switch (subtype) {
            default: {
                return false;
            }
        }
    }

    getTypeMetaData(type: string): TypeMetaData {
        switch (type) {
            case 'State': {
                return {
                    name: 'State',
                    mandatory: [
                        { name: 'actions', type: 'array' },
                        { name: 'transitions', type: 'array' }
                    ]
                };
            }
            case 'Statemachine': {
                return {
                    name: 'Statemachine',
                    mandatory: [
                        { name: 'commands', type: 'array' },
                        { name: 'events', type: 'array' },
                        { name: 'states', type: 'array' }
                    ]
                };
            }
            default: {
                return {
                    name: type,
                    mandatory: []
                };
            }
        }
    }
}

export const reflection = new StatemachineAstReflection();
