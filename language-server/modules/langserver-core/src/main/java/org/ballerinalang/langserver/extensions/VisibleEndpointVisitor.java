/*
 * Copyright (c) 2018, WSO2 Inc. (http://wso2.com) All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.ballerinalang.langserver.extensions;

import org.ballerinalang.langserver.common.LSNodeVisitor;
import org.ballerinalang.langserver.common.utils.CommonUtil;
import org.ballerinalang.langserver.compiler.common.modal.SymbolMetaInfo;
import org.ballerinalang.model.elements.PackageID;
import org.ballerinalang.model.tree.TopLevelNode;
import org.wso2.ballerinalang.compiler.semantics.analyzer.SymbolResolver;
import org.wso2.ballerinalang.compiler.semantics.model.SymbolEnv;
import org.wso2.ballerinalang.compiler.semantics.model.SymbolTable;
import org.wso2.ballerinalang.compiler.semantics.model.symbols.BPackageSymbol;
import org.wso2.ballerinalang.compiler.semantics.model.symbols.BSymbol;
import org.wso2.ballerinalang.compiler.semantics.model.symbols.BVarSymbol;
import org.wso2.ballerinalang.compiler.tree.BLangFunction;
import org.wso2.ballerinalang.compiler.tree.BLangImportPackage;
import org.wso2.ballerinalang.compiler.tree.BLangNode;
import org.wso2.ballerinalang.compiler.tree.BLangPackage;
import org.wso2.ballerinalang.compiler.tree.BLangService;
import org.wso2.ballerinalang.compiler.tree.BLangWorker;
import org.wso2.ballerinalang.compiler.tree.statements.BLangBlockStmt;
import org.wso2.ballerinalang.compiler.tree.statements.BLangForeach;
import org.wso2.ballerinalang.compiler.tree.statements.BLangIf;
import org.wso2.ballerinalang.compiler.tree.statements.BLangSimpleVariableDef;
import org.wso2.ballerinalang.compiler.tree.statements.BLangWhile;
import org.wso2.ballerinalang.compiler.tree.types.BLangObjectTypeNode;
import org.wso2.ballerinalang.compiler.util.CompilerContext;
import org.wso2.ballerinalang.util.Flags;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Find the visible Symbols for Resources and Functions.
 * 
 * @since 0.985.0
 */
public class VisibleEndpointVisitor extends LSNodeVisitor {

    private SymbolEnv symbolEnv;

    private SymbolResolver symbolResolver;

    private SymbolTable symTable;

    private Map<BLangNode, List<SymbolMetaInfo>> visibleEPsByNode;
    
    private Map<PackageID, BLangImportPackage> packageMap;

    public VisibleEndpointVisitor(CompilerContext compilerContext) {
        this.symTable = SymbolTable.getInstance(compilerContext);
        this.symbolResolver = SymbolResolver.getInstance(compilerContext);
        this.visibleEPsByNode = new HashMap<>();
        this.packageMap = new HashMap<>();
    }

    public Map<BLangNode, List<SymbolMetaInfo>> getVisibleEPsByNode() {
        return visibleEPsByNode;
    }

    @Override
    public void visit(BLangPackage pkgNode) {
        SymbolEnv pkgEnv = this.symTable.pkgEnvMap.get(pkgNode.symbol);
        this.symbolEnv = pkgEnv;

        List<TopLevelNode> topLevelNodes = pkgNode.topLevelNodes;
        pkgNode.getImports().forEach(importPackage -> this.packageMap.put(importPackage.symbol.pkgID, importPackage));

        topLevelNodes.stream()
                .filter(CommonUtil.checkInvalidTypesDefs())
                .forEach(topLevelNode -> acceptNode((BLangNode) topLevelNode, pkgEnv));
    }

    @Override
    public void visit(BLangFunction funcNode) {
        SymbolEnv funcEnv = SymbolEnv.createFunctionEnv(funcNode, funcNode.symbol.scope, this.symbolEnv);
        SymbolEnv blockEnv = SymbolEnv.createBlockEnv(funcNode.getBody(), funcEnv);
        // resolve visible in-scope endpoints coming from current module or other modules
        List<SymbolMetaInfo> visibleEPSymbols = resolveVisibleEndpointSymbols(blockEnv, funcNode);
        this.visibleEPsByNode.put(funcNode, visibleEPSymbols);
        this.visit(funcNode.body, funcNode);
        funcNode.body.stmts.forEach(bLangStatement -> bLangStatement.accept(this));
    }

    @Override
    public void visit(BLangService serviceNode) {
        SymbolEnv serviceEnv = SymbolEnv.createServiceEnv(serviceNode, serviceNode.symbol.scope, this.symbolEnv);
        ((BLangObjectTypeNode) serviceNode.serviceTypeDefinition.typeNode).getFunctions().stream()
                .filter(bLangFunction -> (bLangFunction.symbol.flags & Flags.RESOURCE) == Flags.RESOURCE)
                .forEach(bLangFunction -> this.acceptNode(bLangFunction, serviceEnv));
    }

    private void acceptNode(BLangNode node, SymbolEnv env) {
        SymbolEnv prevEnv = this.symbolEnv;
        this.symbolEnv = env;
        node.accept(this);
        this.symbolEnv = prevEnv;
    }

    public void visit(BLangBlockStmt blockNode, BLangNode parent) {
        // resolve locally declared endpoints
        blockNode.stmts.forEach(stmt -> {
            if (stmt instanceof  BLangSimpleVariableDef) {
                BVarSymbol symbol = ((BLangSimpleVariableDef) stmt).var.symbol;
                if (CommonUtil.isClientObject(symbol)) {
                    BLangImportPackage importPackage = this.packageMap.get(symbol.type.tsymbol.pkgID);
                    String typeName = symbol.type.tsymbol.getName().getValue();
                    String pkgName = symbol.pkgID.getName().getValue();
                    String orgName = symbol.pkgID.getOrgName().getValue();
                    String alias = importPackage == null ? "" : importPackage.getAlias().getValue();
                    SymbolMetaInfo visibleEndpoint = new SymbolMetaInfo.SymbolMetaInfoBuilder()
                            .setName(symbol.getName().getValue())
                            .setPkgName(pkgName)
                            .setPkgOrgName(orgName)
                            .setPkgAlias(alias)
                            .setKind("VisibleEndpoint")
                            .setCaller(false)
                            .setTypeName(typeName)
                            .setLocal(true)
                            .setPos(stmt.pos)
                            .build();
                    if (this.visibleEPsByNode.containsKey(parent)) {
                        this.visibleEPsByNode.get(parent).add(visibleEndpoint);
                    } else {
                        this.visibleEPsByNode.put(parent, Arrays.asList(visibleEndpoint));
                    }
                }
            }
        });
    }

    @Override
    public void visit(BLangIf ifNode) {
        this.visit(ifNode.body, ifNode);
        if (ifNode.elseStmt instanceof  BLangBlockStmt) {
            this.visit((BLangBlockStmt) ifNode.elseStmt, ifNode.elseStmt);
        }
    }

    @Override
    public void visit(BLangWhile whileNode) {
        this.visit(whileNode.body, whileNode);
    }

    @Override
    public void visit(BLangWorker workerNode) {
        this.visit(workerNode.body, workerNode);
    }

    @Override
    public void visit(BLangForeach foreach) {
        this.visit(foreach.body, foreach);
    }

    /**
     * Resolve all visible symbols.
     *
     * @param symbolEnv symbol environment
     * @return all visible symbols for current scope
     */
    private List<SymbolMetaInfo> resolveVisibleEndpointSymbols(SymbolEnv symbolEnv, BLangFunction ownerFunction) {
        List<BSymbol> parameters = ownerFunction.getParameters().stream()
                .map(bLangSimpleVariable -> bLangSimpleVariable.symbol)
                .collect(Collectors.toList());
        return symbolResolver.getAllVisibleInScopeSymbols(symbolEnv).entrySet().stream()
                .map(entry -> entry.getValue().symbol)
                .collect(Collectors.toList()).stream()
                .filter(symbol -> symbol instanceof BVarSymbol && CommonUtil.isClientObject(symbol)
                    && (parameters.contains(symbol) || symbol.owner instanceof BPackageSymbol))
                .map(symbol -> {

                    BLangImportPackage importPackage = this.packageMap.get(symbol.type.tsymbol.pkgID);
                    String typeName = symbol.type.tsymbol.getName().getValue();
                    String pkgName = symbol.pkgID.getName().getValue();
                    String orgName = symbol.pkgID.getOrgName().getValue();
                    String alias = importPackage == null ? "" : importPackage.getAlias().getValue();
                    boolean isCaller = parameters.contains(symbol);
                    return new SymbolMetaInfo.SymbolMetaInfoBuilder()
                            .setName(symbol.getName().getValue())
                            .setPkgName(pkgName)
                            .setPkgOrgName(orgName)
                            .setPkgAlias(alias)
                            .setKind("VisibleEndpoint")
                            .setCaller(isCaller)
                            .setTypeName(typeName)
                            .setLocal(false)
                            .build();
                })
                .collect(Collectors.toList());
    }
}
