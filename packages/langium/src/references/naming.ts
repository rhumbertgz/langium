import { findNodeForFeature } from '../grammar/grammar-util';
import { AstNode, CstNode } from '../syntax-tree';

export interface NamedAstNode extends AstNode {
    name: string;
}

export function isNamed(node: AstNode): node is NamedAstNode {
    return (node as NamedAstNode).name !== undefined;
}

export interface NameProvider {
    getName(node: AstNode): string | undefined;
    /**
     * Returns the `CstNode` which contains the parsed value of the `name` assignment.
     * @param node Specified `AstNode` whose name node shall be retrieved.
     */
    getNameNode(node: AstNode): CstNode | undefined;
}

export class DefaultNameProvider implements NameProvider {
    getName(node: AstNode): string | undefined {
        if (isNamed(node)) {
            return node.name;
        }
        return undefined;
    }

    getNameNode(node: AstNode): CstNode | undefined {
        return findNodeForFeature(node.$cstNode, 'name');
    }
}
