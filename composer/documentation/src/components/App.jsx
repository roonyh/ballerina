import React from 'react';
import Documentation from './Documentation';

export default class App extends React.Component {
    getDocumentationDetails(node) {
        const { markdownDocumentationAttachment: mdDoc } = node;
        
        const documentationDetails = {
            title: node.name.value,
            description: mdDoc.documentation,
        };

        const parameters = {};
        node.parameters.forEach(param => {
            parameters[param.name.value] = {
                name: param.name.value,
                type: param.typeNode.typeKind,
            };
        });
        node.defaultableParameters.forEach(param => {
            parameters[param.variable.name.value] = {
                name: param.variable.name.value,
                type: param.variable.typeNode.typeKind,
                defaultValue: param.variable.initialExpression.value,
            };
        });

        documentationDetails.parameters = mdDoc.parameters.map((param) => {
            const { name, type, defaultValue } =  parameters[param.parameterName.value];
            const description = param.parameterDocumentation;
            return {
                name, type, defaultValue, description
            };
        });

        return documentationDetails;
    }

    render() {
        const docElements = [];
        this.props.ast.topLevelNodes.forEach(node => {
            if(node.markdownDocumentationAttachment) {
                const docDetails = this.getDocumentationDetails(node);
                console.log(docDetails)
                docElements.push(
                    <Documentation docDetails={docDetails}/>
                );
            }
        });
        return docElements;
    }
}
