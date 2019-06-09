import {
    Assignment, ASTKindChecker, ASTNode, ASTUtil, Block,
    ExpressionStatement, Function as BalFunction, Invocation, Return, VariableDef, VisibleEndpoint, Visitor, WorkerSend
} from "@ballerina/ast-model";
import { ProjectAST } from "@ballerina/lang-service";
import _ from "lodash";
import { EndpointViewState, FunctionViewState, StmntViewState } from "../view-model";
import { ExpandContext } from "../view-model/expand-context";
import { visitor as initVisitor } from "./init-visitor";

let projectAST: ProjectAST;

// This function processes endpoint parameters of expanded functions
// so that actions to these parameters can be drawn to the original endpoint passed to them
function handleEndpointParams(expandContext: ExpandContext) {
    const invocation = expandContext.expandableNode;
    const expandedFunction = expandContext.expandedSubTree;
    if (!expandedFunction || !expandedFunction.VisibleEndpoints || !expandedFunction.parameters) {
        return;
    }

    const params = expandedFunction.parameters;

    expandedFunction.VisibleEndpoints.forEach((ep) => {
        // Find of one of the visible endpoints is actually a parameter to the function
        params.forEach((p, i) => {
            if (ASTKindChecker.isVariable(p)) {
                if (p.name.value === ep.name) {
                    // visible endpoint is a parameter
                    const arg = invocation.argumentExpressions[i];
                    if (ASTKindChecker.isSimpleVariableRef(arg)) {
                        // This parameter actually refers to an endpoint with name in arg.variableName
                        (ep.viewState as EndpointViewState).actualEpName = arg.variableName.value;
                    }
                }
            }
        });
    });
}

function handleExpanding(expression: ASTNode, viewState: StmntViewState) {
    let invocation;
    if (ASTKindChecker.isInvocation(expression)) {
            invocation = expression;
    } else if (ASTKindChecker.isCheckExpr(expression) &&
        ASTKindChecker.isInvocation(expression.expression)) {
            invocation = expression.expression;
    }
    if (!invocation) {
        return;
    }

    const expandedFunctionOriginalNode = getExpandedSubTree(invocation);
    if (!expandedFunctionOriginalNode ||
        (expandedFunctionOriginalNode.viewState as FunctionViewState).isViewedExpanded) {
        return;
    }

    const expandedFunction = _.cloneDeep(expandedFunctionOriginalNode);
    (expandedFunctionOriginalNode.viewState as FunctionViewState).isViewedExpanded = true;
    expandedFunction.viewState.isExpandedFunction = true;
    ASTUtil.traversNode(expandedFunction, initVisitor);
    ASTUtil.traversNode(expandedFunction, visitor);
    (expandedFunctionOriginalNode.viewState as FunctionViewState).isViewedExpanded = false;

    viewState.expandContext = new ExpandContext(invocation, expandedFunction);
    handleEndpointParams(viewState.expandContext);
}

function getExpandedSubTree(invocation: Invocation): BalFunction | undefined {
    const defLink: string[][] = invocation.definition.slice().reverse();

    if (defLink[0][0] !== "builtin") {
        return;
    }

    const module = projectAST[defLink[1][0]];

    if (!module) {
        return;
    }

    let funcNode: BalFunction | undefined;

    Object.keys(module.compilationUnits).forEach((cUnitName) => {
        const cUnit = module.compilationUnits[cUnitName];
        cUnit.ast.topLevelNodes.forEach((n) => {
            const node = n as ASTNode;
            if (ASTKindChecker.isFunction(node)) {
                if (node.name.value === defLink[2][0]) {
                    funcNode = node;
                }
            }
        });
    });

    return funcNode;
}

export function setProjectAST(ast: ProjectAST) {
    projectAST = ast;
}

export const visitor: Visitor = {

    beginVisitFunction(node: BalFunction) {
        (node.viewState as FunctionViewState).isViewedExpanded = true;
    },

    endVisitFunction(node: BalFunction) {
        (node.viewState as FunctionViewState).isViewedExpanded = false;
    },

    endVisitExpressionStatement(node: ExpressionStatement) {
        if (ASTUtil.isActionInvocation(node)) {
            return;
        }

        const viewState = node.viewState as StmntViewState;
        if (ASTKindChecker.isInvocation(node.expression)) {
            handleExpanding(node.expression, viewState);
        }
    },

    endVisitVariableDef(node: VariableDef) {
        if (ASTKindChecker.isVariable(node.variable) && node.variable.initialExpression) {
            handleExpanding(node.variable.initialExpression, node.viewState as StmntViewState);
        }
    },

    endVisitAssignment(node: Assignment) {
        handleExpanding(node.expression, node.viewState as StmntViewState);
    }
};
