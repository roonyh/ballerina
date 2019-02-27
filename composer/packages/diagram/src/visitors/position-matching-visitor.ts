import { Visitor } from "@ballerina/ast-model";

export function getVisitor(position: any) {
    const visitor: Visitor = {
        beginVisitFunction(node) {
            node.position
        }
    }

    return visitor;
}
