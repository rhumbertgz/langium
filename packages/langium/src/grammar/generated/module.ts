/******************************************************************************
 * This file was generated by langium-cli 0.5.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

import { LanguageMetaData } from '../..';
import { Module } from '../../dependency-injection';
import { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumSharedServices, LangiumServices } from '../../services';
import { LangiumGrammarAstReflection } from './ast';
import { LangiumGrammarGrammar } from './grammar';

export const LangiumGrammarLanguageMetaData: LanguageMetaData = {
    languageId: 'langium',
    fileExtensions: ['.langium'],
    caseInsensitive: false
};

export const LangiumGrammarGeneratedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
    AstReflection: () => new LangiumGrammarAstReflection()
};

export const LangiumGrammarGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Grammar: () => LangiumGrammarGrammar(),
    LanguageMetaData: () => LangiumGrammarLanguageMetaData,
    parser: {}
};
