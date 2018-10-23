import React from 'react';
import ReactMarkdown from 'react-markdown/with-html';
import htmlParser from 'react-markdown/plugins/html-parser';
import { diffChars } from 'diff';
import escape from 'escape-html';
import './Description.css';

export default class Description extends React.Component {
    constructor(props) {
        super(props);
        this.diff = [{
            value: props.source,
        }];
    }

    componentWillReceiveProps(newProps) {
        this.diff = diffChars(this.props.source, newProps.source);
    }

    render() {
        let source = '';
        this.diff.forEach((part) => {
            if (part.removed) {
                return;
            }

            const value = escape(part.value);
            if(part.added) {
                source += `<span class="added">${value}</span>`;
            } else {
                source += value;
            }
        })

        return <ReactMarkdown 
            source={source}
            escapeHtml={false}
            renderers={{
                inlineCode: block => {
                    console.log(block);
                    return <code>haha</code>
                }
            }}
        />
    }
}