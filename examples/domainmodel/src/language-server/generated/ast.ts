/******************************************************************************
 * This file was generated by langium-cli 0.5.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-empty-interface */
import { AstNode, AstReflection, Reference, ReferenceInfo, isAstNode, TypeMetaData } from 'langium';

export type AbstractElement = PackageDeclaration | Type;

export const AbstractElement = 'AbstractElement';

export function isAbstractElement(item: unknown): item is AbstractElement {
    return reflection.isInstance(item, AbstractElement);
}

export type QualifiedName = string;

export type Type = DataType | Entity;

export const Type = 'Type';

export function isType(item: unknown): item is Type {
    return reflection.isInstance(item, Type);
}

export interface DataType extends AstNode {
    readonly $container: Domainmodel | PackageDeclaration;
    name: string
}

export const DataType = 'DataType';

export function isDataType(item: unknown): item is DataType {
    return reflection.isInstance(item, DataType);
}

export interface Domainmodel extends AstNode {
    elements: Array<AbstractElement>
}

export const Domainmodel = 'Domainmodel';

export function isDomainmodel(item: unknown): item is Domainmodel {
    return reflection.isInstance(item, Domainmodel);
}

export interface Entity extends AstNode {
    readonly $container: Domainmodel | PackageDeclaration;
    features: Array<Feature>
    name: string
    superType?: Reference<Entity>
}

export const Entity = 'Entity';

export function isEntity(item: unknown): item is Entity {
    return reflection.isInstance(item, Entity);
}

export interface Feature extends AstNode {
    readonly $container: Entity;
    many: boolean
    name: string
    type: Reference<Type>
}

export const Feature = 'Feature';

export function isFeature(item: unknown): item is Feature {
    return reflection.isInstance(item, Feature);
}

export interface PackageDeclaration extends AstNode {
    readonly $container: Domainmodel | PackageDeclaration;
    elements: Array<AbstractElement>
    name: QualifiedName
}

export const PackageDeclaration = 'PackageDeclaration';

export function isPackageDeclaration(item: unknown): item is PackageDeclaration {
    return reflection.isInstance(item, PackageDeclaration);
}

export type DomainModelAstType = 'AbstractElement' | 'DataType' | 'Domainmodel' | 'Entity' | 'Feature' | 'PackageDeclaration' | 'Type';

export class DomainModelAstReflection implements AstReflection {

    getAllTypes(): string[] {
        return ['AbstractElement', 'DataType', 'Domainmodel', 'Entity', 'Feature', 'PackageDeclaration', 'Type'];
    }

    isInstance(node: unknown, type: string): boolean {
        return isAstNode(node) && this.isSubtype(node.$type, type);
    }

    isSubtype(subtype: string, supertype: string): boolean {
        if (subtype === supertype) {
            return true;
        }
        switch (subtype) {
            case DataType:
            case Entity: {
                return this.isSubtype(Type, supertype);
            }
            case PackageDeclaration:
            case Type: {
                return this.isSubtype(AbstractElement, supertype);
            }
            default: {
                return false;
            }
        }
    }

    getReferenceType(refInfo: ReferenceInfo): string {
        const referenceId = `${refInfo.container.$type}:${refInfo.property}`;
        switch (referenceId) {
            case 'Entity:superType': {
                return Entity;
            }
            case 'Feature:type': {
                return Type;
            }
            default: {
                throw new Error(`${referenceId} is not a valid reference id.`);
            }
        }
    }

    getTypeMetaData(type: string): TypeMetaData {
        switch (type) {
            case 'Domainmodel': {
                return {
                    name: 'Domainmodel',
                    mandatory: [
                        { name: 'elements', type: 'array' }
                    ]
                };
            }
            case 'Entity': {
                return {
                    name: 'Entity',
                    mandatory: [
                        { name: 'features', type: 'array' }
                    ]
                };
            }
            case 'Feature': {
                return {
                    name: 'Feature',
                    mandatory: [
                        { name: 'many', type: 'boolean' }
                    ]
                };
            }
            case 'PackageDeclaration': {
                return {
                    name: 'PackageDeclaration',
                    mandatory: [
                        { name: 'elements', type: 'array' }
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

export const reflection = new DomainModelAstReflection();
