import React from "react";
import { DiagramContext, DiagramMode, IDiagramContext } from "./diagram-context";

export class ModeToggleButton extends React.Component {

    public static contextType = DiagramContext;

    public render() {
        return <React.Fragment>
            <button onClick={this.changeMode.bind(this)} >Toggle Diagram Mode</button>
        </React.Fragment>;
    }

    private changeMode(): void {
        const currentMode = (this.context as IDiagramContext).mode;
        if (currentMode === DiagramMode.ACTION) {
            this.context.changeMode(DiagramMode.DEFAULT);
        } else {
            this.context.changeMode(DiagramMode.ACTION);
        }
    }
}