import {
    Assignment, ASTKindChecker,
    ASTNode, ASTUtil, Block, Break, CompoundAssignment, Constant,
    ExpressionStatement, Foreach, Function as BalFunction, If, Invocation, Lambda,
    Literal, Match, MatchStaticPatternClause, ObjectType,
    Panic, Return, Service, TypeDefinition, UnionTypeNode,
    ValueType, Variable, VariableDef, VisibleEndpoint, Visitor, While, WorkerReceive, WorkerSend
} from "@ballerina/ast-model";
import { DiagramConfig } from "../config/default";
import { DiagramUtils } from "../diagram/diagram-utils";
import { EndpointViewState, FunctionViewState, SimpleBBox, StmntViewState, ViewState } from "../view-model";
import { BlockViewState } from "../view-model/block";
import { ReturnViewState } from "../view-model/return";
import { WorkerViewState } from "../view-model/worker";
import { WorkerSendViewState } from "../view-model/worker-send";

const config: DiagramConfig = DiagramUtils.getConfig();
interface WorkerTuple { block: Block; view: WorkerViewState; }

class SizingVisitor implements Visitor {
    private endpointHolder: VisibleEndpoint[] = [];
    private returnStatements: Return[] = [];

    public beginVisitFunction(node: BalFunction) {
        const viewState: FunctionViewState = node.viewState;
        if (!node.lambda) {
            this.endpointHolder = [];
            if (node.VisibleEndpoints) {
                this.endpointHolder = [...node.VisibleEndpoints, ...this.endpointHolder];
            }
            // clear return statements.
            this.returnStatements = [];
        }
        // If resource set the caller as first param.
        if (node.resource && node.VisibleEndpoints !== undefined) {
            const caller = node.VisibleEndpoints.find((element: VisibleEndpoint) => {
                return element.caller;
            });
            if (caller) {
                viewState.client = caller.viewState;
                (caller.viewState as EndpointViewState).visible = true;
                (caller.viewState as EndpointViewState).usedAsClient = true;
            } else {
                viewState.client = new ViewState();
            }
        }
    }

    public beginVisitVariableDef(node: VariableDef) {
        if (ASTUtil.isWorker(node)) {
            const variable = node.variable;
            const lambda: Lambda = variable.initialExpression as Lambda;
            const functionNode = lambda.functionNode;
            if (functionNode.VisibleEndpoints) {
                this.endpointHolder = [...functionNode.VisibleEndpoints, ...this.endpointHolder];
            }
        }
    }

    public beginVisitIf(node: If) {
        node.viewState.bBox.paddingTop = config.flowCtrl.paddingTop;
        if (node.VisibleEndpoints) {
            this.endpointHolder = [...node.VisibleEndpoints, ...this.endpointHolder];
        }
    }

    public beginVisitWhile(node: While) {
        node.viewState.bBox.paddingTop = config.flowCtrl.paddingTop;
        if (node.VisibleEndpoints) {
            this.endpointHolder = [...node.VisibleEndpoints, ...this.endpointHolder];
        }
    }

    public beginVisitForeach(node: Foreach) {
        node.viewState.bBox.paddingTop = config.flowCtrl.paddingTop;
        if (node.VisibleEndpoints) {
            this.endpointHolder = [...node.VisibleEndpoints, ...this.endpointHolder];
        }
    }

    public endVisitFunction(node: BalFunction) {
        if (node.lambda || !node.body) { return; }
        const viewState: FunctionViewState = node.viewState;
        const body = viewState.body;
        const header = viewState.header;
        const client = viewState.client;
        const defaultWorker = viewState.defaultWorker;
        const workerHolder: WorkerTuple[] = [];

        // Initialize the client width and height to default.
        client.bBox.h = config.lifeLine.line.height + (config.lifeLine.header.height * 2);
        client.bBox.w = config.lifeLine.width;

        // Size default worker
        defaultWorker.bBox.h = node.body!.viewState.bBox.h + (config.lifeLine.header.height * 2)
            + config.statement.height  // leave room for start call.
            + config.statement.height; // for bottom plus
        defaultWorker.bBox.w = (node.body!.viewState.bBox.w) ? node.body!.viewState.bBox.w :
            config.lifeLine.width;
        defaultWorker.lifeline.bBox.w = config.lifeLine.width;
        defaultWorker.name = "default";
        workerHolder.push({ block: node.body, view: defaultWorker });

        // tslint:disable-next-line:prefer-conditional-expression
        if (node.body!.viewState.bBox.leftMargin) {
            defaultWorker.bBox.leftMargin = node.body!.viewState.bBox.leftMargin;
        } else {
            defaultWorker.bBox.leftMargin = config.lifeLine.leftMargin;
        }
        // Size the other workers
        let lineHeight = (client.bBox.h > defaultWorker.bBox.h) ? client.bBox.h : defaultWorker.bBox.h;
        let workerWidth = 0;
        defaultWorker.initHeight = this.calcPreWorkerHeight(node.body);
        const workers = node.body!.statements.filter((element) => ASTUtil.isWorker(element));
        workers.forEach((workerEl) => {
            const worker = workerEl as VariableDef;
            this.sizeWorker(worker, defaultWorker.initHeight, workerHolder);
            if (lineHeight < worker.viewState.bBox.h) {
                lineHeight = worker.viewState.bBox.h;
            }
            workerWidth += worker.viewState.bBox.w;
        });
        // Set Worker Arrows
        this.syncWorkerInteractions(workerHolder);
        // Sync up the heights of lifelines
        client.bBox.h = defaultWorker.bBox.h = lineHeight;
        defaultWorker.lifeline.bBox.h = defaultWorker.bBox.h; // Set the height of lifeline.
        // Sync height of workers
        workers.forEach((worker) => {
            const workerViewState: WorkerViewState = worker.viewState;
            workerViewState.bBox.h = lineHeight;
            workerViewState.lifeline.bBox.h = lineHeight;
        });

        // Size endpoints
        let endpointWidth = 0;
        if (this.endpointHolder) {
            this.endpointHolder.forEach((endpoint: VisibleEndpoint) => {
                if (!endpoint.caller && endpoint.viewState.visible) {
                    endpoint.viewState.bBox.w = config.lifeLine.width;
                    endpoint.viewState.bBox.h = client.bBox.h;
                    endpointWidth += endpoint.viewState.bBox.w + config.lifeLine.gutter.h;
                }
            });
        }

        const lifeLinesWidth = client.bBox.w + config.lifeLine.gutter.h
            + defaultWorker.bBox.w + endpointWidth + workerWidth;
        body.w = config.panel.padding.left + lifeLinesWidth + config.panel.padding.right;
        body.h = config.panel.padding.top + lineHeight + config.panel.padding.bottom;

        header.w = config.panelHeading.padding.left + config.panelHeading.padding.right;
        header.h = config.panelHeading.height;

        viewState.bBox.w = (body.w > header.w) ? body.w : header.w;
        viewState.bBox.h = body.h + header.h;
        viewState.endpointsWidth = endpointWidth;
        viewState.workerWidth = workerWidth;
        viewState.containsOtherLifelines = workers.length > 0 || this.endpointHolder.length > 0;

        // Update return statement view-states.
        this.returnStatements.forEach((returnStmt) => {
            const returnViewState: ReturnViewState = returnStmt.viewState;
            returnViewState.client = client;
            // hide empty return stmts in resources
            if (node.resource) {
                returnViewState.hidden =
                    returnStmt.noExpressionAvailable
                    || (ASTKindChecker.isLiteral(returnStmt.expression)
                        && (returnStmt.expression as Literal).emptyParantheses === true);
            }
        });

        // show an implicit return line for functions with return type nil
        // and doesn't have any return statements
        if (!node.resource && this.returnStatements.length === 0) {
            const isNilType = (target: ASTNode) => ASTKindChecker.isValueType(target)
                && (target as ValueType).typeKind === "nil";

            // case one: returns () or no return type declaration
            viewState.implicitReturn.hidden = !(isNilType(node.returnTypeNode)
                // case two: returns a union type which wraps nil
                || (ASTKindChecker.isUnionTypeNode(node.returnTypeNode)
                    && (node.returnTypeNode as UnionTypeNode).memberTypeNodes.find(isNilType) !== undefined));
            viewState.implicitReturn.client = client;
            viewState.implicitReturn.bBox.h = config.statement.height;
            viewState.implicitReturn.bBox.w = config.statement.width;
        }
    }

    public endVisitBlock(node: Block) {
        const viewState: BlockViewState = node.viewState;
        let height = 0;
        viewState.bBox.w = config.statement.width;
        node.statements.forEach((element) => {
            if (ASTUtil.isWorker(element) ||
                ASTKindChecker.isReturn(element)
            ) { return; }
            viewState.bBox.w = (viewState.bBox.w < element.viewState.bBox.w)
                ? element.viewState.bBox.w : viewState.bBox.w;
            viewState.bBox.leftMargin = (viewState.bBox.leftMargin < element.viewState.bBox.leftMargin)
                ? element.viewState.bBox.leftMargin : viewState.bBox.leftMargin;
            height += element.viewState.bBox.h + element.viewState.bBox.paddingTop;
        });
        viewState.bBox.h = ((height === 0) ? config.statement.height : height) + config.block.bottomMargin;
        const hoverRectLeftMargin = viewState.bBox.leftMargin === 0
            ? config.block.hoverRect.leftMargin
            : viewState.bBox.leftMargin;

        viewState.hoverRect.h = viewState.bBox.h;
        viewState.hoverRect.w = viewState.bBox.w + hoverRectLeftMargin;
        viewState.hoverRect.leftMargin = hoverRectLeftMargin;
    }

    public endVisitWhile(node: While) {
        const viewState: ViewState = node.viewState;
        const bodyBBox: SimpleBBox = node.body.viewState.bBox;

        viewState.bBox.w = node.body.viewState.bBox.w + config.flowCtrl.rightMargin;
        viewState.bBox.h = node.body.viewState.bBox.h + config.flowCtrl.condition.height
            + config.flowCtrl.condition.bottomMargin
            + config.flowCtrl.whileGap + config.flowCtrl.bottomMargin;
        // If body has a left margin assign to while
        // tslint:disable-next-line:prefer-conditional-expression
        if (bodyBBox.leftMargin) {
            viewState.bBox.leftMargin = bodyBBox.leftMargin + config.flowCtrl.leftMargin;
        } else {
            viewState.bBox.leftMargin = config.flowCtrl.leftMarginDefault;
        }
    }

    public endVisitForeach(node: Foreach) {
        const viewState: ViewState = node.viewState;
        const bodyBBox: SimpleBBox = node.body.viewState.bBox;

        viewState.bBox.w = node.body.viewState.bBox.w + config.flowCtrl.rightMargin;
        viewState.bBox.h = node.body.viewState.bBox.h + config.flowCtrl.foreach.height
            + config.flowCtrl.whileGap + config.flowCtrl.bottomMargin;
        // If body has a left margin assign to while
        // tslint:disable-next-line:prefer-conditional-expression
        if (bodyBBox.leftMargin) {
            viewState.bBox.leftMargin = bodyBBox.leftMargin + config.flowCtrl.leftMargin;
        } else {
            viewState.bBox.leftMargin = config.flowCtrl.leftMarginDefault;
        }
    }

    public endVisitIf(node: If) {
        const viewState: ViewState = node.viewState;
        const bodyBBox: SimpleBBox = node.body.viewState.bBox;

        viewState.bBox.w = node.body.viewState.bBox.w + config.flowCtrl.rightMargin;
        viewState.bBox.h = node.body.viewState.bBox.h + config.flowCtrl.condition.height
            + config.flowCtrl.condition.bottomMargin
            + config.flowCtrl.bottomMargin;
        // If body has a left margin assign to while
        // tslint:disable-next-line:prefer-conditional-expression
        if (bodyBBox.leftMargin) {
            viewState.bBox.leftMargin = bodyBBox.leftMargin + config.flowCtrl.leftMargin;
        } else {
            viewState.bBox.leftMargin = config.flowCtrl.leftMarginDefault;
        }

        // Add Else block
        if (node.elseStatement) {
            viewState.bBox.h += node.elseStatement.viewState.bBox.h;
            viewState.bBox.w += node.elseStatement.viewState.bBox.w;
        }
    }

    public endVisitExpressionStatement(node: ExpressionStatement) {
        this.sizeStatement(node);
    }

    public endVisitVariableDef(node: VariableDef) {
        this.sizeStatement(node);
    }

    public endVisitAssignment(node: Assignment) {
        this.sizeStatement(node);
    }

    public endVisitReturn(node: Return) {
        this.sizeStatement(node);
        node.viewState.bBox.label = DiagramUtils
            .getTextWidth(ASTUtil.genSource(node.expression)).text;
        this.returnStatements.push(node);
    }

    public endVisitCompoundAssignment(node: CompoundAssignment) {
        this.sizeStatement(node);
    }

    public endVisitWorkerSend(node: WorkerSend) {
        this.sizeStatement(node);
    }

    public endVisitPanic(node: Panic) {
        this.sizeStatement(node);
    }

    public endVisitBreak(node: Break) {
        this.sizeStatement(node);
    }

    public endVisitConstant(node: Constant) {
        this.sizeStatement(node);
    }

    public endVisitService(node: Service) {
        const viewState: ViewState = node.viewState;
        let height = config.panelGroup.header.height;
        // tslint:disable-next-line:ban-types
        node.resources.forEach((element: BalFunction) => {
            viewState.bBox.w = (viewState.bBox.w > element.viewState.bBox.w)
                ? viewState.bBox.w : element.viewState.bBox.w;
            height += element.viewState.bBox.h;
            element.viewState.icon = "resource";
        });
        viewState.bBox.h = height;
    }

    public endVisitTypeDefinition(node: TypeDefinition) {
        // If it is a service do nothing.
        if (node.service || !ASTUtil.isValidObjectType(node)) { return; }
        const viewState: ViewState = node.viewState;
        let height = config.panelGroup.header.height;
        // tslint:disable-next-line:ban-types
        (node.typeNode as ObjectType).functions.forEach((element: BalFunction) => {
            viewState.bBox.w = (viewState.bBox.w > element.viewState.bBox.w)
                ? viewState.bBox.w : element.viewState.bBox.w;
            height += element.viewState.bBox.h;
            element.viewState.icon = "function";
        });
        viewState.bBox.h = height;
    }

    public endVisitMatchStaticPatternClause(node: MatchStaticPatternClause) {
        const viewState: ViewState = node.viewState;
        viewState.bBox.w = node.statement.viewState.bBox.w;
        viewState.bBox.h = node.statement.viewState.bBox.h
            + config.statement.height; // To print literal
        viewState.bBox.label = DiagramUtils.getTextWidth(ASTUtil.genSource(node.literal)).text;
    }

    public endVisitMatch(node: Match) {
        const viewState: ViewState = node.viewState;
        let height = config.frame.topMargin + config.frame.header.height;
        let width = 0;
        node.patternClauses.forEach((element) => {
            height += element.viewState.bBox.h;
            width = (width > element.viewState.bBox.w) ?
                width : element.viewState.bBox.w;
        });
        viewState.bBox.h = height;
        viewState.bBox.w = width;
        viewState.bBox.leftMargin = 60;
    }

    private sizeStatement(node: ASTNode) {
        const viewState: StmntViewState = node.viewState;
        // If hidden do nothing.
        if (node.viewState.hidden) {
            viewState.bBox.h = 0;
            viewState.bBox.w = 0;
            return;
        }

        const source = ASTUtil.genSource(node);
        const label = DiagramUtils.getTextWidth(source);
        viewState.bBox.h = config.statement.height;
        viewState.bBox.w = (config.statement.width > label.w) ? config.statement.width : label.w;
        viewState.bBox.label = label.text;
        viewState.bBox.labelWidth = label.labelWidth;
        // Check if statement is action invocation.
        const action = ASTUtil.isActionInvocation(node);
        if (action) {
            // find the endpoint view state
            const epName = ASTUtil.getEndpointName(action as Invocation);

            let endpoint = this.endpointHolder.find((el: VisibleEndpoint) => el.name === epName);
            if (endpoint) {
                const actualEpName = (endpoint.viewState as EndpointViewState).actualEpName;
                if (actualEpName) {
                    endpoint = this.endpointHolder.find((el: VisibleEndpoint) => el.name === actualEpName);
                }
            }

            if (endpoint && !endpoint.caller) {
                viewState.endpoint = endpoint.viewState;
                viewState.isAction = true;
                viewState.bBox.h = config.statement.actionHeight;
                let actionName = ASTUtil.genSource(action as Invocation).split("->").pop();
                actionName = (actionName) ? actionName : "";
                viewState.bBox.label = DiagramUtils.getTextWidth(actionName).text;
                // Set visible to true so we can only draw used endpoints.
                (endpoint.viewState as EndpointViewState).visible = true;
                viewState.isReturn = (endpoint.viewState as EndpointViewState).usedAsClient;
            }
        }

        if (node.viewState.hiddenBlock) {
            viewState.bBox.w = 60;
        }

        if (viewState.expandContext) {
            // add space for the expander
            viewState.bBox.w += 10;
            if (viewState.expandContext.expandedSubTree) {
                viewState.expandContext.labelWidth = DiagramUtils.calcTextLength(source, {bold: true});
                this.handleExpandedFn(viewState.expandContext.expandedSubTree, viewState);
            }
        }
    }

    private handleExpandedFn(expandedFn: BalFunction, viewState: StmntViewState) {
        if (!expandedFn.body) {
            return;
        }

        const expandedBody = (expandedFn.body.viewState as BlockViewState).bBox;
        const expandedFnViewState = expandedFn.viewState as FunctionViewState;
        const expandedDefaultWorker = expandedFnViewState.defaultWorker.bBox;
        ASTUtil.traversNode(expandedFn, new SizingVisitor());
        const sizes = config.statement.expanded;

        if (sizes.offset > expandedBody.leftMargin) {
            expandedBody.leftMargin = sizes.offset;
        }

        let expandedFnWidth = expandedBody.w + expandedBody.leftMargin;
        // const workers = expandedFn.body.statements.filter((element) => ASTUtil.isWorker(element));

        // workers.forEach((worker) => {
        //     const variable: Variable = ((worker as VariableDef).variable as Variable);
        //     const lambda: Lambda = (variable.initialExpression as Lambda);
        //     const fnVS = lambda.functionNode.body!.viewState as BlockViewState;
        //     const leftMargin = fnVS.bBox.leftMargin > 0 ? fnVS.bBox.leftMargin : 60;
        //     expandedFnWidth += (fnVS.bBox.w + leftMargin);
        // });

        expandedFnWidth += expandedFnViewState.workerWidth;

        // let visibleEndpoints = [];
        // if (expandedFn.VisibleEndpoints) {
        //     visibleEndpoints = expandedFn.VisibleEndpoints.filter((ep) => !ep.caller && ep.viewState.visible);
        //     visibleEndpoints.forEach((endpoint: VisibleEndpoint) => {
        //         endpoint.viewState.bBox.w = config.lifeLine.width;
        //         expandedFnWidth += (endpoint.viewState.bBox.w + config.lifeLine.gutter.h);
        //     });
        // }

        expandedFnWidth += expandedFnViewState.endpointsWidth;
        expandedFnWidth += sizes.rightMargin;

        const expandedFnHeight = expandedFnViewState.containsOtherLifelines ?
            expandedDefaultWorker.h : expandedBody.h;

        viewState.bBox.h = expandedFnHeight + sizes.header + sizes.footer + sizes.bottomMargin;
        const fullLabelWidth = config.statement.padding.left + viewState.expandContext!.labelWidth
            + sizes.rightMargin + (2 * sizes.labelGutter);

        viewState.bBox.w = expandedFnWidth > fullLabelWidth ? expandedFnWidth : fullLabelWidth;
    }

    private sizeWorker(node: VariableDef, preWorkerHeight = 0, workerHolder: WorkerTuple[]) {
        const variable: Variable = (node.variable as Variable);
        const lambda: Lambda = (variable.initialExpression as Lambda);
        const functionNode = lambda.functionNode;
        const viewState: WorkerViewState = node.viewState;
        // set top pad
        functionNode.body!.viewState.paddingTop = preWorkerHeight;
        viewState.bBox.h = functionNode.body!.viewState.bBox.h + (config.lifeLine.header.height * 2)
            + functionNode.body!.viewState.paddingTop
            + config.statement.height  // leave room for start call.
            + config.statement.height; // for bottom plus
        viewState.bBox.w = (functionNode.body!.viewState.bBox.w) ? functionNode.body!.viewState.bBox.w :
            config.lifeLine.width;
        viewState.lifeline.bBox.w = config.lifeLine.width;
        // tslint:disable-next-line:prefer-conditional-expression
        if (functionNode.body!.viewState.bBox.leftMargin) {
            viewState.bBox.leftMargin = functionNode.body!.viewState.bBox.leftMargin;
        } else {
            viewState.bBox.leftMargin = config.lifeLine.leftMargin;
        }
        viewState.name = variable.name.value.replace("0", "");
        workerHolder.push({ block: functionNode.body!, view: viewState });
    }

    private calcPreWorkerHeight(body: Block) {
        let height = config.statement.height * 2;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < body!.statements.length; i++) {
            const statement = body!.statements[i];
            if (ASTUtil.isWorker(statement)) {
                break;
            }
            height += statement.viewState.bBox.h;
        }
        return height;
    }

    private syncWorkerInteractions(workers: WorkerTuple[]) {
        const sendReceivePairs: Array<{
            send: WorkerSend,
            sendIndex: number,
            receive: WorkerReceive,
            receiveIndex: number,
            receiveHolder: ASTNode}> = [];
        const sends: {[fromWorker: string]: {[toWorker: string]:
            Array<{statement: WorkerSend, index: number}>}} = {};
        const receives: {[toWorker: string]: {[fromWorker: string]:
            Array<{statement: WorkerReceive, index: number, holder: ASTNode}>}} = {};

        const workersMap: {[workerName: string]: WorkerTuple} = {};
        const workerHeightInfo: {[workerName: string]: {currentHeight: number, currentIndex: number}} = {};

        workers.forEach((worker) => {
            sends[worker.view.name] = {};
            receives[worker.view.name] = {};
            workersMap[worker.view.name] = worker;
            workerHeightInfo[worker.view.name] = {
                currentHeight: 0,
                currentIndex: 0
            };

            worker.block.statements.forEach((statement, index) => {
                if (ASTKindChecker.isWorkerSend(statement)) {
                    if (sends[worker.view.name][statement.workerName.value] === undefined) {
                        sends[worker.view.name][statement.workerName.value] = [];
                    }
                    sends[worker.view.name][statement.workerName.value].push({statement, index});
                    return;
                }

                const receiveStatement = ASTUtil.extractWorkerReceive(statement);
                if (receiveStatement) {
                    if (receives[worker.view.name][receiveStatement.workerName.value] === undefined) {
                        receives[worker.view.name][receiveStatement.workerName.value] = [];
                    }
                    receives[worker.view.name][receiveStatement.workerName.value].push(
                        {statement: receiveStatement, index, holder: statement});
                }
            });
        });

        workers.forEach((fromWorker) => {
            workers.forEach((toWorker) => {
                if (fromWorker === toWorker) {
                    return;
                }
                if (!sends[fromWorker.view.name][toWorker.view.name]
                    || !receives[toWorker.view.name][fromWorker.view.name]) {
                    return;
                }
                sends[fromWorker.view.name][toWorker.view.name].forEach(({statement: send, index: sendIndex}) => {
                    (send.viewState as WorkerSendViewState).to = toWorker.view;
                    const r = receives[toWorker.view.name][fromWorker.view.name].shift();
                    if (!r) {
                        return;
                    }

                    const { statement: receive, index: receiveIndex, holder: receiveHolder } = r;
                    sendReceivePairs.push({ send, sendIndex, receive, receiveIndex, receiveHolder});
                });
            });
        });
        sendReceivePairs.sort((p1, p2) => {
            if (p1.send.workerName.value === p2.send.workerName.value) {
                return p1.receiveIndex - p2.receiveIndex;
            }
            if (p1.send.workerName.value === p2.receive.workerName.value) {
                return p1.receiveIndex - p2.sendIndex;
            }
            if (p1.receive.workerName.value === p2.send.workerName.value) {
                return p1.sendIndex - p2.receiveIndex;
            }
            if (p1.receive.workerName.value === p2.receive.workerName.value) {
                return p1.sendIndex - p2.sendIndex;
            }
            return 0;
        });
        sendReceivePairs.forEach((pair) => {
            const sendWorker = workersMap[pair.receive.workerName.value];
            for (let index = workerHeightInfo[sendWorker.view.name].currentIndex; index < pair.sendIndex; index++) {
                workerHeightInfo[sendWorker.view.name].currentHeight +=
                    sendWorker.block.statements[index].viewState.bBox.h
                    + sendWorker.block.statements[index].viewState.bBox.paddingTop;
            }
            workerHeightInfo[sendWorker.view.name].currentIndex = pair.sendIndex;

            const receiveWorker = workersMap[pair.send.workerName.value];
            for (let index = workerHeightInfo[receiveWorker.view.name].currentIndex;
                index < pair.receiveIndex; index++) {
                workerHeightInfo[receiveWorker.view.name].currentHeight +=
                    receiveWorker.block.statements[index].viewState.bBox.h
                    + receiveWorker.block.statements[index].viewState.bBox.paddingTop;
            }
            workerHeightInfo[receiveWorker.view.name].currentIndex = pair.receiveIndex;
            const sendHeight = workerHeightInfo[sendWorker.view.name].currentHeight;
            const receiveHeight = workerHeightInfo[receiveWorker.view.name].currentHeight;

            if (sendHeight > receiveHeight) {
                pair.receiveHolder.viewState.bBox.paddingTop = sendHeight - receiveHeight;
            } else {
                pair.send.viewState.bBox.paddingTop = receiveHeight - sendHeight;
            }
        });
    }
}

export const visitor = new SizingVisitor();
