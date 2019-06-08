package org.ballerinalang.langserver.extensions.ballerina.project;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.ballerinalang.langserver.LSGlobalContext;
import org.ballerinalang.langserver.LSGlobalContextKeys;
import org.ballerinalang.langserver.compiler.DocumentServiceKeys;
import org.ballerinalang.langserver.compiler.LSCompiler;
import org.ballerinalang.langserver.compiler.LSContext;
import org.ballerinalang.langserver.compiler.LSServiceOperationContext;
import org.ballerinalang.langserver.compiler.common.LSCustomErrorStrategy;
import org.ballerinalang.langserver.compiler.common.modal.SymbolMetaInfo;
import org.ballerinalang.langserver.compiler.format.JSONGenerationException;
import org.ballerinalang.langserver.compiler.format.TextDocumentFormatUtil;
import org.ballerinalang.langserver.compiler.workspace.WorkspaceDocumentManager;
import org.ballerinalang.langserver.extensions.VisibleEndpointVisitor;
import org.ballerinalang.langserver.extensions.ballerina.document.BallerinaASTRequest;
import org.ballerinalang.langserver.extensions.ballerina.document.BallerinaASTResponse;
import org.ballerinalang.model.tree.TopLevelNode;
import org.wso2.ballerinalang.compiler.tree.BLangCompilationUnit;
import org.wso2.ballerinalang.compiler.tree.BLangNode;
import org.wso2.ballerinalang.compiler.tree.BLangPackage;
import org.wso2.ballerinalang.compiler.util.CompilerContext;

import java.net.URISyntaxException;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.locks.Lock;

/**
 * Implementation of Ballerina Project extension for Language Server.
 *
 * @since 1.0.0
 */
public class BallerinaProjectServiceImpl implements BallerinaProjectService {
    private final WorkspaceDocumentManager documentManager;
    private final LSCompiler lsCompiler;

    public BallerinaProjectServiceImpl(LSGlobalContext globalContext) {
        this.documentManager = globalContext.get(LSGlobalContextKeys.DOCUMENT_MANAGER_KEY);
        this.lsCompiler = new LSCompiler(documentManager);
    }

    @Override
    public CompletableFuture<ModulesResponse> modules (ModulesRequest request) {

        ModulesResponse reply = new ModulesResponse();
        String sourceRoot = request.getSourceRoot();
        try {
            LSContext astContext = new LSServiceOperationContext();
            astContext.put(DocumentServiceKeys.SOURCE_ROOT_KEY, sourceRoot);
            List<BLangPackage> modules = lsCompiler.getBLangModules(astContext, this.documentManager, true,
                    LSCustomErrorStrategy.class);
            JsonObject jsonModulesInfo = getJsonReply(astContext, modules);
            reply.setModules(jsonModulesInfo);
            reply.setParseSuccess(true);
        } catch (JSONGenerationException | URISyntaxException e) {
            reply.setParseSuccess(false);
        }
        return CompletableFuture.supplyAsync(() -> reply);
    }

    private JsonObject getJsonReply(LSContext astContext, List<BLangPackage> modules) throws JSONGenerationException {
        JsonObject jsonModules = new JsonObject();

        for (BLangPackage module : modules) {
            JsonObject jsonModule = new JsonObject();
            jsonModule.addProperty("name", module.symbol.name.value);
            CompilerContext compilerContext = astContext.get(DocumentServiceKeys.COMPILER_CONTEXT_KEY);

            VisibleEndpointVisitor visibleEndpointVisitor = new VisibleEndpointVisitor(compilerContext);
            visibleEndpointVisitor.visit(module);
            Map<BLangNode, List<SymbolMetaInfo>> visibleEPsByNode = visibleEndpointVisitor.getVisibleEPsByNode();

            JsonObject jsonCUnits = new JsonObject();
            for (BLangCompilationUnit cUnit: module.getCompilationUnits()) {
                JsonObject jsonCUnit = new JsonObject();
                jsonCUnit.addProperty("name", cUnit.name);
                JsonElement jsonAST = TextDocumentFormatUtil.generateJSON(cUnit, new HashMap<>(), visibleEPsByNode);
                jsonCUnit.add("ast", jsonAST);
                jsonCUnits.add(cUnit.name, jsonCUnit);
            }
            jsonModule.add("compilationUnits", jsonCUnits);
            jsonModules.add(module.symbol.name.value, jsonModule);
        }

        return jsonModules;
    }
}
