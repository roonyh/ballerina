import { CompilationUnit, traversNode } from "@ballerina/ast-model";
import React from "react";
import { visitor as sizingVisitor } from "../sizing/sizing-visitor";
import * as components from "../views";
import { DiagramContext, DiagramMode, IDiagramContext } from "./diagram-context";
import { DiagramErrorBoundary } from "./diagram-error-boundary";
import { EditToggleButton } from "./edit-toggle-button";
import { ModeToggleButton } from "./mode-toggle-button";

export interface CommonDiagramProps {
    height: number;
    width: number;
    zoom: number;
    mode: DiagramMode;
}
export interface DiagramProps extends CommonDiagramProps {
    ast?: CompilationUnit;
}

export interface DiagramState {
    currentMode: DiagramMode;
}

export class Diagram extends React.Component<DiagramProps, DiagramState> {

    // get default context or provided context from a parent (if any)
    public static contextType = DiagramContext;

    public state = {
        currentMode: DiagramMode.ACTION,
    };

    public render() {
        const { ast } = this.props;
        const { currentMode } = this.state;
        const children: any = [];

        if (ast) {
            traversNode(ast, sizingVisitor);
            ast.topLevelNodes.forEach((node) => {
                const ChildComp = (components as any)[node.kind];
                if (!ChildComp) { return; }

                children.push(<ChildComp model={node}/>);
            });
        }

        return <DiagramContext.Provider value={this.createContext()}>
            <DiagramErrorBoundary>
                <div>{"Current Diagram Mode: " + DiagramMode[currentMode] }</div>
                <div>{"Editing Enabled: " + this.context.editingEnabled }</div>
                <EditToggleButton />
                <ModeToggleButton />
                {/* <div>{JSON.stringify(ast)}</div> */}
                { children }
            </DiagramErrorBoundary>
        </DiagramContext.Provider>;
    }

    private createContext(): IDiagramContext {
        const { ast } = this.props;
        const { currentMode } = this.state;
        // create context contributions
        const contextContributions = {
            ast,
            changeMode: (newMode: DiagramMode) => {
                this.setState({
                    currentMode: newMode,
                });
            },
            mode: currentMode,
        };

        // merge with parent (if any) or with default context
        return { ...this.context, ...contextContributions };
    }
}