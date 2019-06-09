import {  ASTKindChecker, ASTNode, Function as BalFunction, Invocation } from "@ballerina/ast-model";
import { ProjectAST } from "@ballerina/lang-service";
import * as _ from "lodash";
import { FunctionViewState } from "./function";

export class ExpandContext {
    public expandedSubTree: BalFunction | undefined;
    public expandedSubTreeDocUri: string = ""; // The uri of the bal file where the definition is in
    public expandableNode: Invocation;
    public labelWidth: number = 0;

    constructor(expandableNode: Invocation, expandedSubTree: BalFunction) {
        this.expandableNode = expandableNode;
        this.expandedSubTree = expandedSubTree;
    }
}
