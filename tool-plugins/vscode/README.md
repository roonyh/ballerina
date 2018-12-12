# Ballerina plugin for Visual Studio Code

The future apps we write increasingly depend upon programmable endpoints. The discipline of resilient communication between endpoints is integration. It is a domain of hard problems.

[Ballerina](http://ballerina.io) is a simple programming language whose syntax and runtime address the hard problems of integration. As a Turing complete language, Ballerina enables agility with edit, build, and run cycles. Ballerina code is compiled into services that include transactions, embedded brokers and gateway runtimes.

Ballerina makes it easy to build resilient services that integration and orchestrate across distributed endpoints. The Ballerina plugin includes intellisense, diagramming, debugging, code formatting, and refactoring.

## Quick start
- Download and install ballerina from [ballerina.io](https://ballerina.io/downloads/).
- Install VSCode plugin.
    - **Option 1.** Install this extension from the VSCode [marketplace](https://marketplace.visualstudio.com/items?itemName=ballerina.ballerina) (or by entering `ext install Ballerina.Ballerina` at the command palette).
    - **Option 2.** Download and install the VSCode plugin manually.
        - Download `ballerina-vscode-plugin-VERSION.vsix` from [ballerina.io](https://ballerina.io/downloads/). When downloading make sure plugin version matches the platform version you have installed.
        - Go to Install from VSIX... command in the Extensions View command drop-down, or the Extensions: Install from VSIX... command in the Command Palette, and select the .vsix file to install. [More info](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix)

## Plugin Features

### Language Support

* Code completion : <kbd>CTRL</kbd> + <kbd>SPACE</kbd>
* Go to definition 
    * Jump to source: <kbd>CTRL</kbd> + <kbd>Click</kbd>
    * Open to the side with <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Click</kbd>
* Go to symbol : <kbd>CTRL</kbd> + <kbd>SHIFT</kbd> + <kbd>O</kbd>

For a complete list of features please see the Ballerina Language Server [User Guide](https://github.com/ballerina-platform/ballerina-lang/blob/master/language-server/docs/UserGuide.md).

### Diagram View

Ballerina’s underlying language semantics were designed by modeling how independent parties communicate via structured interactions. Subsequently, every Ballerina program can be displayed as a sequence diagram of its flow with endpoints, including synchronous and asynchronous calls. 

To view the sequence diagram of a ballerina file press the diagram icon ( ![design view icon](https://github.com/ballerina-platform/ballerina-lang/blob/master/tool-plugins/vscode/docs/show-diagram-icon.png?raw=true) ) in top right corner.

![opening design view](https://github.com/ballerina-platform/ballerina-lang/blob/master/tool-plugins/vscode/docs/diagram.gif?raw=true)

## Compatibility

Ballerina Language Specification supports a set of experimental features such as *_transactions_* syntax. In order to be compatible with the experimental features and for supporting language intelligence in VSCode Plugin, enable the `Allow Experimental` option in user settings. 

## Contributing

If you want to help develop the ballerina vscode plugin or want to build from source and try out the latest features see [information for developers](https://github.com/ballerina-platform/ballerina-lang/blob/master/tool-plugins/vscode/docs/developer-info.md).


## License

Ballerina Visual Studio Code plugin source is available under the Apache 2.0 License.

## Copyright

Copyright (c) 2018, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
