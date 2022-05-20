/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, CstNode, DefaultRenameHandler, findLeafNodeAtOffset, flattenCst, getDocument, isReference, LangiumDocument, LangiumDocuments, LangiumServices, MaybePromise, streamAst} from 'langium';
import { WorkspaceEdit, Location, Range, ReferenceParams } from 'vscode-languageserver';
import { RenameParams } from 'vscode-languageserver-protocol';
import { TextEdit } from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';

export class DomainModelRenameHandler extends DefaultRenameHandler {

    protected readonly langiumDocuments: LangiumDocuments;
    constructor(services: LangiumServices) {
        super(services);
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
    }

    async renameElement(document: LangiumDocument, params: RenameParams): Promise<WorkspaceEdit | undefined> {
        const changes: Record<string, TextEdit[]> = {};
        const references = await this.getAllReferencesWithPrunedRanges(document, { ...params, context: { includeDeclaration: true } });
        if (!Array.isArray(references)) {
            return undefined;
        }
        references.forEach(location => {
            const change = TextEdit.replace(location.range, params.newName);
            if (changes[location.uri]) {
                changes[location.uri].push(change);
            } else {
                changes[location.uri] = [change];
            }
        });
        return { changes };
    }

    getAllReferencesWithPrunedRanges(document: LangiumDocument, params: ReferenceParams): MaybePromise<Location[]> {
        const rootNode = document.parseResult.value.$cstNode;
        if (!rootNode) {
            return [];
        }
        const refs: Array<{ docUri: URI, range: Range }> = [];
        const selectedNode = findLeafNodeAtOffset(rootNode, document.textDocument.offsetAt(params.position));
        if (!selectedNode) {
            return [];
        }
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;

        if (targetAstNode) {
            if (params.context.includeDeclaration) {
                const declDoc = getDocument(targetAstNode);
                const nameNode = this.findNameNode(targetAstNode, selectedNode.text);
                if (nameNode)
                    refs.push({ docUri: declDoc.uri, range: nameNode.range });
            }
            for (const node of streamAst(targetAstNode)) {
                this.references.findReferences(node).forEach(reference => {
                    if (isReference(reference)) {
                        const adjustedRange = this.pruneRangeToNamePart(document.uri, reference.$refNode.range, selectedNode.text);
                        if (adjustedRange) refs.push({docUri:document.uri, range: adjustedRange});
                    } else {
                        const adjustedRange = this.pruneRangeToNamePart(reference.sourceUri, reference.segment.range, selectedNode.text);
                        if (adjustedRange) refs.push({docUri: reference.sourceUri, range: adjustedRange });
                    }
                });
            }
        }
        return refs.map(ref => Location.create(
            ref.docUri.toString(),
            ref.range
        ));
    }

    protected pruneRangeToNamePart(uri: URI, completeRange: Range, nameToReplace: string): Range | undefined {
        const langiumDoc = this.langiumDocuments.getOrCreateDocument(uri);
        const completeRangeText= langiumDoc.textDocument.getText(completeRange);
        const startIndex = completeRangeText.indexOf(nameToReplace);
        const endIndex = startIndex + nameToReplace.length;
        if (startIndex === -1) return undefined;
        const retRange: Range = {
            start: { line: completeRange.start.line, character: completeRange.start.character + startIndex},
            end: {line: completeRange.end.line, character: completeRange.start.character + endIndex}
        };
        return retRange;
    }

    protected findNameNode(node: AstNode, name: string): CstNode | undefined {
        const nameNode = this.nameProvider.getNameNode(node);
        if (nameNode)
            return nameNode;
        if (node.$cstNode) {
            // try find first leaf with name as text
            const leafNode = flattenCst(node.$cstNode).find((n) => n.text === name);
            if (leafNode)
                return leafNode;
        }
        return node.$cstNode;
    }
}
