### apps.presentation.list_saved @ 1.0.0

Shared component listSaved. Builds and drafts remain separate from explicit saved assets.

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{},"required":[],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"assets":{"items":{"oneOf":[{"additionalProperties":false,"oneOf":[{"required":["binding"]},{"required":["componentId"]}],"properties":{"assetId":{"minLength":1,"type":"string"},"binding":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"componentId":{"minLength":1,"type":"string"},"entryKind":{"enum":["data","component"]},"kind":{"const":"entry"},"legacyBinding":{"additionalProperties":false,"properties":{"datasetKey":{"minLength":1,"type":"string"},"fieldMap":{"additionalProperties":{"type":"string"},"type":"object"},"id":{"minLength":1,"type":"string"},"query":{"additionalProperties":false,"properties":{"params":{"type":"object"},"tool":{"minLength":1,"type":"string"}},"required":["tool","params"],"type":"object"}},"required":["id","fieldMap"],"type":"object"},"legacyFieldOrder":{"items":{"minLength":1,"type":"string"},"type":"array"},"order":{"type":"integer"},"pinned":{"type":"boolean"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"}},"required":["assetId","kind","title","userRequest","pinned","order"],"type":"object"},{"additionalProperties":false,"properties":{"assetId":{"minLength":1,"type":"string"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"description":{"type":"string"},"design":{},"kind":{"const":"template"},"savedAt":{"minLength":1,"type":"string"},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"}},"required":["assetId","kind","title","design","bindings","userRequest"],"type":"object"}]},"type":"array"},"components":{"items":{"additionalProperties":false,"properties":{"componentId":{"minLength":1,"type":"string"},"legacyTemplate":{},"revision":{"minimum":1,"type":"integer"},"revisions":{"items":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"revision":{"minimum":1,"type":"integer"},"savedAt":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"}},"required":["revision","title","savedAt"],"type":"object"},"type":"array"},"savedAt":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"},"view":{"additionalProperties":false,"properties":{"baseRevision":{"minimum":1,"type":"integer"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"createdAt":{"minLength":1,"type":"string"},"design":{},"initialData":{"items":{"additionalProperties":false,"properties":{"bindingId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"status":{"enum":["ready","failed","unavailable","empty"]}},"required":["bindingId","datasetId","status"],"type":"object"},"type":"array"},"ownerSessionId":{"type":["string","null"]},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"sourceComponentId":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"updatedAt":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","ownerSessionId","title","design","bindings","createdAt","updatedAt"],"type":"object"}},"required":["componentId","revision","title","view","userRequest","savedAt"],"type":"object"},"type":"array"}},"required":["components","assets"],"type":"object"}`

### apps.presentation.manage_saved @ 1.0.0

Shared component manageSaved. Builds and drafts remain separate from explicit saved assets.

Effect: mutation; completion: response.

Input: `{"additionalProperties":false,"properties":{"action":{"enum":["rename","delete","pin","reorder"]},"id":{"minLength":1,"type":"string"},"kind":{"enum":["component","entry","template"]},"name":{"minLength":1,"type":"string"},"order":{"type":"integer"},"pinned":{"type":"boolean"}},"required":["kind","id","action"],"type":"object"}`

Output: `{"oneOf":[{"additionalProperties":false,"properties":{"componentId":{"minLength":1,"type":"string"},"legacyTemplate":{},"revision":{"minimum":1,"type":"integer"},"revisions":{"items":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"revision":{"minimum":1,"type":"integer"},"savedAt":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"}},"required":["revision","title","savedAt"],"type":"object"},"type":"array"},"savedAt":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"},"view":{"additionalProperties":false,"properties":{"baseRevision":{"minimum":1,"type":"integer"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"createdAt":{"minLength":1,"type":"string"},"design":{},"initialData":{"items":{"additionalProperties":false,"properties":{"bindingId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"status":{"enum":["ready","failed","unavailable","empty"]}},"required":["bindingId","datasetId","status"],"type":"object"},"type":"array"},"ownerSessionId":{"type":["string","null"]},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"sourceComponentId":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"updatedAt":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","ownerSessionId","title","design","bindings","createdAt","updatedAt"],"type":"object"}},"required":["componentId","revision","title","view","userRequest","savedAt"],"type":"object"},{"additionalProperties":false,"oneOf":[{"required":["binding"]},{"required":["componentId"]}],"properties":{"assetId":{"minLength":1,"type":"string"},"binding":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"componentId":{"minLength":1,"type":"string"},"entryKind":{"enum":["data","component"]},"kind":{"const":"entry"},"legacyBinding":{"additionalProperties":false,"properties":{"datasetKey":{"minLength":1,"type":"string"},"fieldMap":{"additionalProperties":{"type":"string"},"type":"object"},"id":{"minLength":1,"type":"string"},"query":{"additionalProperties":false,"properties":{"params":{"type":"object"},"tool":{"minLength":1,"type":"string"}},"required":["tool","params"],"type":"object"}},"required":["id","fieldMap"],"type":"object"},"legacyFieldOrder":{"items":{"minLength":1,"type":"string"},"type":"array"},"order":{"type":"integer"},"pinned":{"type":"boolean"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"}},"required":["assetId","kind","title","userRequest","pinned","order"],"type":"object"},{"additionalProperties":false,"properties":{"assetId":{"minLength":1,"type":"string"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"description":{"type":"string"},"design":{},"kind":{"const":"template"},"savedAt":{"minLength":1,"type":"string"},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"}},"required":["assetId","kind","title","design","bindings","userRequest"],"type":"object"},{"additionalProperties":false,"properties":{"deleted":{"const":true},"id":{"minLength":1,"type":"string"}},"required":["deleted","id"],"type":"object"}]}`

### apps.presentation.open_component @ 1.0.0

Shared component openComponent. Builds and drafts remain separate from explicit saved assets.

Effect: compute; completion: response.

Input: `{"additionalProperties":false,"properties":{"componentId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"revision":{"minimum":1,"type":"integer"}},"required":["componentId"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"baseRevision":{"minimum":1,"type":"integer"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"createdAt":{"minLength":1,"type":"string"},"design":{},"initialData":{"items":{"additionalProperties":false,"properties":{"bindingId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"status":{"enum":["ready","failed","unavailable","empty"]}},"required":["bindingId","datasetId","status"],"type":"object"},"type":"array"},"ownerSessionId":{"type":["string","null"]},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"sourceComponentId":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"updatedAt":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","ownerSessionId","title","design","bindings","createdAt","updatedAt"],"type":"object"}`

### apps.presentation.open_source_component @ 1.0.0

Shared component openSource. Builds and drafts remain separate from explicit saved assets.

Effect: compute; completion: response.

Input: `{"additionalProperties":false,"properties":{"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"directory":{"minLength":1,"type":"string"},"legacyBindings":{"items":{"additionalProperties":false,"properties":{"datasetKey":{"minLength":1,"type":"string"},"fieldMap":{"additionalProperties":{"type":"string"},"type":"object"},"id":{"minLength":1,"type":"string"},"query":{"additionalProperties":false,"properties":{"params":{"type":"object"},"tool":{"minLength":1,"type":"string"}},"required":["tool","params"],"type":"object"}},"required":["id","fieldMap"],"type":"object"},"type":"array"},"title":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["directory"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"baseRevision":{"minimum":1,"type":"integer"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"createdAt":{"minLength":1,"type":"string"},"design":{},"initialData":{"items":{"additionalProperties":false,"properties":{"bindingId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"status":{"enum":["ready","failed","unavailable","empty"]}},"required":["bindingId","datasetId","status"],"type":"object"},"type":"array"},"ownerSessionId":{"type":["string","null"]},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"sourceComponentId":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"updatedAt":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","ownerSessionId","title","design","bindings","createdAt","updatedAt"],"type":"object"}`

### apps.presentation.render_view @ 1.0.0

Shared component renderView. Builds and drafts remain separate from explicit saved assets.

Effect: compute; completion: response.

Input: `{"additionalProperties":false,"properties":{"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"design":{},"directory":{"minLength":1,"type":"string"},"legacyBindings":{"items":{"additionalProperties":false,"properties":{"datasetKey":{"minLength":1,"type":"string"},"fieldMap":{"additionalProperties":{"type":"string"},"type":"object"},"id":{"minLength":1,"type":"string"},"query":{"additionalProperties":false,"properties":{"params":{"type":"object"},"tool":{"minLength":1,"type":"string"}},"required":["tool","params"],"type":"object"}},"required":["id","fieldMap"],"type":"object"},"type":"array"},"legacyNeedsSpecification":{"type":"boolean"},"legacyViewId":{"minLength":1,"type":"string"},"requiredBindingIds":{"items":{"minLength":1,"type":"string"},"type":"array"},"templateId":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["title"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"baseRevision":{"minimum":1,"type":"integer"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"createdAt":{"minLength":1,"type":"string"},"design":{},"initialData":{"items":{"additionalProperties":false,"properties":{"bindingId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"status":{"enum":["ready","failed","unavailable","empty"]}},"required":["bindingId","datasetId","status"],"type":"object"},"type":"array"},"ownerSessionId":{"type":["string","null"]},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"sourceComponentId":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"updatedAt":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","ownerSessionId","title","design","bindings","createdAt","updatedAt"],"type":"object"}`

### apps.presentation.save_component @ 1.0.0

Shared component saveComponent. Builds and drafts remain separate from explicit saved assets.

Effect: mutation; completion: response.

Input: `{"additionalProperties":false,"properties":{"componentId":{"minLength":1,"type":"string"},"expectedRevision":{"minimum":1,"type":"integer"},"legacyComponentId":{"minLength":1,"type":"string"},"legacyTemplate":{},"mode":{"enum":["save_as","update"]},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","userRequest","mode"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"componentId":{"minLength":1,"type":"string"},"legacyTemplate":{},"revision":{"minimum":1,"type":"integer"},"revisions":{"items":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"revision":{"minimum":1,"type":"integer"},"savedAt":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"}},"required":["revision","title","savedAt"],"type":"object"},"type":"array"},"savedAt":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"},"view":{"additionalProperties":false,"properties":{"baseRevision":{"minimum":1,"type":"integer"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"createdAt":{"minLength":1,"type":"string"},"design":{},"initialData":{"items":{"additionalProperties":false,"properties":{"bindingId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"status":{"enum":["ready","failed","unavailable","empty"]}},"required":["bindingId","datasetId","status"],"type":"object"},"type":"array"},"ownerSessionId":{"type":["string","null"]},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"sourceComponentId":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"updatedAt":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","ownerSessionId","title","design","bindings","createdAt","updatedAt"],"type":"object"}},"required":["componentId","revision","title","view","userRequest","savedAt"],"type":"object"}`

### apps.presentation.save_entry @ 1.0.0

Shared component saveEntry. Builds and drafts remain separate from explicit saved assets.

Effect: mutation; completion: response.

Input: `{"additionalProperties":false,"properties":{"binding":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"legacyBinding":{"additionalProperties":false,"properties":{"datasetKey":{"minLength":1,"type":"string"},"fieldMap":{"additionalProperties":{"type":"string"},"type":"object"},"id":{"minLength":1,"type":"string"},"query":{"additionalProperties":false,"properties":{"params":{"type":"object"},"tool":{"minLength":1,"type":"string"}},"required":["tool","params"],"type":"object"}},"required":["id","fieldMap"],"type":"object"},"legacyFieldOrder":{"items":{"minLength":1,"type":"string"},"type":"array"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"}},"required":["title","binding","userRequest"],"type":"object"}`

Output: `{"additionalProperties":false,"oneOf":[{"required":["binding"]},{"required":["componentId"]}],"properties":{"assetId":{"minLength":1,"type":"string"},"binding":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"componentId":{"minLength":1,"type":"string"},"entryKind":{"enum":["data","component"]},"kind":{"const":"entry"},"legacyBinding":{"additionalProperties":false,"properties":{"datasetKey":{"minLength":1,"type":"string"},"fieldMap":{"additionalProperties":{"type":"string"},"type":"object"},"id":{"minLength":1,"type":"string"},"query":{"additionalProperties":false,"properties":{"params":{"type":"object"},"tool":{"minLength":1,"type":"string"}},"required":["tool","params"],"type":"object"}},"required":["id","fieldMap"],"type":"object"},"legacyFieldOrder":{"items":{"minLength":1,"type":"string"},"type":"array"},"order":{"type":"integer"},"pinned":{"type":"boolean"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"}},"required":["assetId","kind","title","userRequest","pinned","order"],"type":"object"}`

### apps.presentation.save_template @ 1.0.0

Shared component saveTemplate. Builds and drafts remain separate from explicit saved assets.

Effect: mutation; completion: response.

Input: `{"additionalProperties":false,"properties":{"description":{"type":"string"},"name":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","name","userRequest"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"assetId":{"minLength":1,"type":"string"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"description":{"type":"string"},"design":{},"kind":{"const":"template"},"savedAt":{"minLength":1,"type":"string"},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"title":{"minLength":1,"type":"string"},"userRequest":{"minLength":1,"type":"string"}},"required":["assetId","kind","title","design","bindings","userRequest"],"type":"object"}`

### apps.presentation.update_view @ 1.0.0

Shared component updateView. Builds and drafts remain separate from explicit saved assets.

Effect: compute; completion: response.

Input: `{"additionalProperties":false,"properties":{"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"design":{},"title":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"baseRevision":{"minimum":1,"type":"integer"},"bindings":{"items":{"additionalProperties":false,"properties":{"appId":{"minLength":1,"type":"string"},"bindingId":{"minLength":1,"type":"string"},"capabilityId":{"minLength":1,"type":"string"},"capabilityMajor":{"minimum":1,"type":"integer"},"connectionId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"input":{},"projection":{"items":{"minLength":1,"type":"string"},"type":"array"},"refresh":{"additionalProperties":false,"properties":{"mode":{"enum":["manual","scheduled"]},"scheduleId":{"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}},"required":["bindingId","appId","connectionId","capabilityId","capabilityMajor","input","projection","refresh"],"type":"object"},"type":"array"},"createdAt":{"minLength":1,"type":"string"},"design":{},"initialData":{"items":{"additionalProperties":false,"properties":{"bindingId":{"minLength":1,"type":"string"},"datasetId":{"minLength":1,"type":"string"},"status":{"enum":["ready","failed","unavailable","empty"]}},"required":["bindingId","datasetId","status"],"type":"object"},"type":"array"},"ownerSessionId":{"type":["string","null"]},"source":{"additionalProperties":false,"properties":{"buildId":{"minLength":1,"type":"string"},"directory":{"minLength":1,"type":"string"},"entry":{"minLength":1,"type":"string"},"files":{"items":{"minLength":1,"type":"string"},"type":"array"},"preview":{"additionalProperties":false,"properties":{"capturedAt":{"minLength":1,"type":"string"},"height":{"type":"number"},"reportPath":{"minLength":1,"type":"string"},"screenshotPath":{"minLength":1,"type":"string"},"width":{"type":"number"}},"required":["screenshotPath","reportPath"],"type":"object"},"thumbnail":{"minLength":1,"type":"string"}},"required":["buildId","directory","entry","files"],"type":"object"},"sourceComponentId":{"minLength":1,"type":"string"},"title":{"minLength":1,"type":"string"},"updatedAt":{"minLength":1,"type":"string"},"viewId":{"minLength":1,"type":"string"}},"required":["viewId","ownerSessionId","title","design","bindings","createdAt","updatedAt"],"type":"object"}`

### hallmark.api.actions.candidates @ 1.0.0

已登记接口 ozonActionCandidatesList；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.api.actions.list @ 1.0.0

已登记接口 ozonActionsList；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.api.actions.products @ 1.0.0

已登记接口 ozonActionProductsList；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.api.category.read @ 1.0.0

已登记接口 hallmarkCategoryRead；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"aspects":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":10,"type":"array"},"attributeId":{"description":"规范正整数属性ID","maxLength":4000,"minLength":1,"type":"string"},"descriptionCategoryId":{"description":"规范正整数类目ID","maxLength":4000,"minLength":1,"type":"string"},"dictionaryId":{"description":"规范正整数字典ID","maxLength":4000,"minLength":1,"type":"string"},"limit":{"maximum":100,"minimum":1,"type":"integer"},"mode":{"enum":["search","show","template","values","validate_value","sync"],"type":"string"},"q":{"description":"search必填；values可选；最多200个Unicode字符，不允许*","maxLength":4000,"minLength":1,"type":"string"},"requireAspects":{"type":"boolean"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"},"typeId":{"description":"规范正整数typeId","maxLength":4000,"minLength":1,"type":"string"},"valueId":{"description":"规范正整数字典值ID","maxLength":4000,"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}`

Output: `{"additionalProperties":true,"oneOf":[{"required":["raw"]},{"required":["spill"]}],"properties":{"datasetKey":{"minLength":1,"type":"string"},"query":{"additionalProperties":false,"properties":{"params":{"additionalProperties":true,"type":"object"},"tool":{"const":"hallmark_get_category_data"}},"required":["tool","params"],"type":"object"},"raw":{"additionalProperties":true,"type":"object"},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"required":["datasetKey","query"],"type":"object"}`

### hallmark.api.collected_item.raw @ 1.0.0

已登记接口 hallmarkCollectedItemRawRead；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"itemId":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["itemId"],"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["id","content","truncated"]},{"required":["spill"]}],"properties":{"content":{"type":"string"},"id":{"minLength":1,"type":"string"},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"},"truncated":{"type":"boolean"}},"type":"object"}`

### hallmark.api.products.attributes @ 1.0.0

已登记接口 ozonProductsAttributesRead；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.api.products.import_inspect @ 1.0.0

已登记接口 ozonProductImportInspect；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.api.products.info @ 1.0.0

已登记接口 ozonProductsInfoRead；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.api.products.prices @ 1.0.0

已登记接口 ozonProductsPricesRead；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.api.products.stocks @ 1.0.0

已登记接口 ozonProductStocksRead；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.api.products.update_price @ 1.0.0

已登记的 Hallmark 普通调价适配操作，委托既有 WriteOperations 的输入核实、操作账本和只读 inspect；不是固定 URL 的直接调用。有已核实店铺任务时使用 task platform 调价并按同一商品、币种和金额回读；仅 TASK_CONTEXT_REQUIRED、CNY、无 actionId/oldPrice 且适配器具备普通 CNY 提交/读取/核实接口时，沿既有严格两位小数 CNY fallback。该 fallback 核实历史 price-state，不宣称实时平台回读。结果保留原请求编号、原始响应和 readback；unknown 仅查询原操作，不重发。

Effect: mutation; completion: readback.

Input: `{"additionalProperties":false,"properties":{"actionId":{"minimum":1,"type":"integer"},"clientOperationKey":{"description":"同一逻辑修改必须复用；未知结果先查询操作","maxLength":4000,"minLength":1,"type":"string"},"currency":{"maxLength":4000,"minLength":1,"type":"string"},"offerIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"oldPrice":{"type":"number"},"price":{"minimum":0.01,"type":"number"},"productIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"scopeConfirmed":{"type":"boolean"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"},"userRequest":{"description":"本轮用户明确修改指令原话","maxLength":4000,"minLength":1,"type":"string"},"valueSource":{"description":"user 或 rule:规则名，不允许猜测数值","maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"input":{"additionalProperties":true,"type":"object"},"items":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"kind":{"minLength":1,"type":"string"},"operationId":{"minLength":1,"type":"string"},"state":{"enum":["pending","running","succeeded","failed","partial","unknown"]},"storeId":{"type":"string"},"targets":{"items":{"minLength":1,"type":"string"},"type":"array"}},"required":["operationId","kind","storeId","state","targets","input","items"],"type":"object"}`

### hallmark.api.store_products.read @ 1.0.0

已登记接口 hallmarkStoreProductsRead；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["products","stores"]},{"required":["spill"]}],"properties":{"products":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"},"stores":{"items":{"additionalProperties":true,"type":"object"},"type":"array"}},"type":"object"}`

### hallmark.api.store_products.sync @ 1.0.0

已登记接口 hallmarkStoreProductsSync；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{},"type":"object"}`

Output: `{"additionalProperties":true,"type":"object"}`

### hallmark.api.stores.list @ 1.0.0

已登记接口 hallmarkStoresList；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{},"type":"object"}`

Output: `{"items":{"additionalProperties":true,"anyOf":[{"required":["id"]},{"required":["storeId"]},{"required":["store_id"]}],"properties":{"id":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"},"store_id":{"minLength":1,"type":"string"}},"type":"object"},"type":"array"}`

### hallmark.api.target_margin.read @ 1.0.0

已登记接口 hallmarkTargetMarginRead；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{},"type":"object"}`

Output: `{"additionalProperties":true,"type":"object"}`

### hallmark.api.warehouses.list @ 1.0.0

已登记接口 ozonWarehousesList；使用 Hallmark 原实现并保留请求/响应证据

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"additionalProperties":true,"type":"object"},"store":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.app.info @ 1.0.0

说明应用能力、边界、来源、保存规则与后端状态

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{},"required":[],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"appId":{"const":"hallmark"},"boundaries":{"additionalProperties":true,"type":"object"},"instructions":{"minLength":1,"type":"string"},"tools":{"items":{"additionalProperties":false,"properties":{"kind":{"minLength":1,"type":"string"},"name":{"minLength":1,"type":"string"}},"required":["name","kind"],"type":"object"},"type":"array"}},"required":["appId","instructions","tools","boundaries"],"type":"object"}`

### hallmark.categories.read @ 1.0.0

读取明确店铺的类目。search必填q，limit默认10且不超过20；show/template必填descriptionCategoryId+typeId；values另需attributeId，limit默认50且不超过100，可选q至少2字；validate_value另需attributeId+valueId+dictionaryId；sync只传店铺和mode，同步只读类目缓存。禁止模式外字段。返回datasetKey和raw（过大则spill），快照payload为原文；ok仅代表读取成功，须保留partial/stale与未核实候选，不将候选当允许值

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"aspects":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":10,"type":"array"},"attributeId":{"description":"规范正整数属性ID","maxLength":4000,"minLength":1,"type":"string"},"descriptionCategoryId":{"description":"规范正整数类目ID","maxLength":4000,"minLength":1,"type":"string"},"dictionaryId":{"description":"规范正整数字典ID","maxLength":4000,"minLength":1,"type":"string"},"limit":{"maximum":100,"minimum":1,"type":"integer"},"mode":{"enum":["search","show","template","values","validate_value","sync"],"type":"string"},"q":{"description":"search必填；values可选；最多200个Unicode字符，不允许*","maxLength":4000,"minLength":1,"type":"string"},"requireAspects":{"type":"boolean"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"},"typeId":{"description":"规范正整数typeId","maxLength":4000,"minLength":1,"type":"string"},"valueId":{"description":"规范正整数字典值ID","maxLength":4000,"minLength":1,"type":"string"}},"required":["mode"],"type":"object"}`

Output: `{"additionalProperties":true,"oneOf":[{"required":["raw"]},{"required":["spill"]}],"properties":{"datasetKey":{"minLength":1,"type":"string"},"query":{"additionalProperties":false,"properties":{"params":{"additionalProperties":true,"type":"object"},"tool":{"const":"hallmark_get_category_data"}},"required":["tool","params"],"type":"object"},"raw":{"additionalProperties":true,"type":"object"},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"required":["datasetKey","query"],"type":"object"}`

### hallmark.collected.get @ 1.0.0

获取单个采集商品完整原始字段

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"itemId":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["itemId"],"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["id","content","truncated"]},{"required":["spill"]}],"properties":{"content":{"type":"string"},"id":{"minLength":1,"type":"string"},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"},"truncated":{"type":"boolean"}},"type":"object"}`

### hallmark.collected.search @ 1.0.0

搜索浏览器扩展已有采集摘要，不触发采集。返回items、分页cursor及可直接绑定组件的datasetKey；保留源返回顺序，不保证按采集时间排序；没有时间证据不声称最近。已保存组件可按同一查询与分页范围只读刷新

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"cursor":{"maxLength":4000,"minLength":1,"type":"string"},"limit":{"maximum":200,"minimum":1,"type":"integer"},"query":{"maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"anyOf":[{"additionalProperties":true,"properties":{"cursor":{"type":"string"},"datasetKey":{"minLength":1,"type":"string"},"items":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"total":{"minimum":0,"type":"integer"}},"required":["datasetKey","items","total"],"type":"object"},{"additionalProperties":true,"properties":{"cursor":{"type":"string"},"datasetKey":{"minLength":1,"type":"string"},"limit":{"minimum":0,"type":"integer"},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"},"total":{"minimum":0,"type":"integer"}},"required":["datasetKey","spill","total","cursor","limit"],"type":"object"}]}`

### hallmark.datasets.refresh @ 1.0.0

只读同步并更新快照，不上品/调价/改库存或触发扩展采集

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"datasetKey":{"maxLength":4000,"minLength":1,"type":"string"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"counts":{"additionalProperties":{"minimum":0,"type":"integer"},"type":"object"},"datasetKey":{"minLength":1,"type":"string"},"snapshot":{"additionalProperties":true,"type":"object"}},"required":["datasetKey","snapshot","counts"],"type":"object"}`

### hallmark.datasets.status @ 1.0.0

查询数据集上次成功时间、刷新状态与错误

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"datasetKey":{"maxLength":4000,"minLength":1,"type":"string"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"datasetKey":{"minLength":1,"type":"string"},"lastError":{},"lastSuccessAt":{"type":["string","null"]},"state":{"minLength":1,"type":"string"}},"required":["datasetKey","state","lastSuccessAt","lastError"],"type":"object"}`

### hallmark.operations.get @ 1.0.0

读取写入/刷新状态；unknown 时必须先查询，禁止自动重写

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"operationId":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["operationId"],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"input":{"additionalProperties":true,"type":"object"},"items":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"kind":{"minLength":1,"type":"string"},"operationId":{"minLength":1,"type":"string"},"state":{"enum":["pending","running","succeeded","failed","partial","unknown"]},"storeId":{"type":"string"},"targets":{"items":{"minLength":1,"type":"string"},"type":"array"}},"required":["operationId","kind","storeId","state","targets","input","items"],"type":"object"}`

### hallmark.operations.list @ 1.0.0

按当前会话、店铺和时间读取操作记录

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"limit":{"maximum":200,"minimum":1,"type":"integer"},"since":{"maxLength":4000,"minLength":1,"type":"string"},"storeId":{"maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"items":{"additionalProperties":true,"properties":{"input":{"additionalProperties":true,"type":"object"},"items":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"kind":{"minLength":1,"type":"string"},"operationId":{"minLength":1,"type":"string"},"state":{"enum":["pending","running","succeeded","failed","partial","unknown"]},"storeId":{"type":"string"},"targets":{"items":{"minLength":1,"type":"string"},"type":"array"}},"required":["operationId","kind","storeId","state","targets","input","items"],"type":"object"},"type":"array"}`

### hallmark.platform.read @ 1.0.0

仅对白名单只读平台端点调用，自动关联内部任务

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"body":{"type":"object"},"method":{"enum":["GET","POST"],"type":"string"},"path":{"maxLength":4000,"minLength":1,"type":"string"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"}},"required":["path"],"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["response"]},{"required":["spill"]}],"properties":{"httpStatus":{"type":"integer"},"outcome":{"enum":["pending","response_received","outcome_unknown"]},"response":{},"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"}},"type":"object"}`

### hallmark.products.filter @ 1.0.0

按参考利润率/价格/库存筛选，缺成本无法判断；结果集保留 24h

Effect: compute; completion: response.

Input: `{"additionalProperties":false,"properties":{"maxMargin":{"type":"number"},"maxPrice":{"type":"number"},"maxStock":{"type":"number"},"minMargin":{"type":"number"},"minPrice":{"type":"number"},"minStock":{"type":"number"},"resultSetId":{"maxLength":4000,"minLength":1,"type":"string"},"status":{"maxLength":4000,"minLength":1,"type":"string"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"expiresAt":{"format":"date-time","type":"string"},"payload":{"additionalProperties":true,"anyOf":[{"required":["products","unable"]},{"required":["matchedCount","unableCount"]}],"properties":{"matchedCount":{"minimum":0,"type":"integer"},"products":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"total":{"minimum":0,"type":"integer"},"unable":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"unableCount":{"minimum":0,"type":"integer"}},"required":["total"],"type":"object"},"resultSetId":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"}},"required":["resultSetId","storeId","expiresAt","payload"],"type":"object"}`

### hallmark.products.list @ 1.0.0

读取店铺商品最近快照，保留原始源字段与时间

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"cursor":{"maxLength":4000,"minLength":1,"type":"string"},"limit":{"maximum":200,"minimum":1,"type":"integer"},"query":{"maxLength":4000,"minLength":1,"type":"string"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"anyOf":[{"additionalProperties":true,"properties":{"products":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"total":{"minimum":0,"type":"integer"}},"required":["products","total"],"type":"object"},{"additionalProperties":true,"properties":{"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"},"storeId":{"minLength":1,"type":"string"},"total":{"minimum":0,"type":"integer"}},"required":["spill","storeId","total"],"type":"object"}]}`

### hallmark.products.list_product @ 1.0.0

仅上品用户指定的已有采集商品和 SKU 范围，不隐式全采集箱。仅在用户本轮明确要求修改时调用；缺信息必须澄清；unknown 禁止再次写入，先查询操作。

Effect: mutation; completion: readback.

Input: `{"additionalProperties":false,"properties":{"clientOperationKey":{"description":"同一逻辑修改必须复用；未知结果先查询操作","maxLength":4000,"minLength":1,"type":"string"},"collectedItemId":{"maxLength":4000,"minLength":1,"type":"string"},"importItems":{"items":{"type":"object"},"maxItems":100,"minItems":1,"type":"array"},"offerIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"productIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"scopeConfirmed":{"type":"boolean"},"skuScope":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"},"userRequest":{"description":"本轮用户明确修改指令原话","maxLength":4000,"minLength":1,"type":"string"},"valueSource":{"description":"user 或 rule:规则名，不允许猜测数值","maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"input":{"additionalProperties":true,"type":"object"},"items":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"kind":{"minLength":1,"type":"string"},"operationId":{"minLength":1,"type":"string"},"state":{"enum":["pending","running","succeeded","failed","partial","unknown"]},"storeId":{"type":"string"},"targets":{"items":{"minLength":1,"type":"string"},"type":"array"}},"required":["operationId","kind","storeId","state","targets","input","items"],"type":"object"}`

### hallmark.products.update_price @ 1.0.0

修改显式商品清单的价格并只读核实。仅在用户本轮明确要求修改时调用；缺信息必须澄清；unknown 禁止再次写入，先查询操作。

Effect: mutation; completion: readback.

Input: `{"additionalProperties":false,"properties":{"actionId":{"minimum":1,"type":"integer"},"clientOperationKey":{"description":"同一逻辑修改必须复用；未知结果先查询操作","maxLength":4000,"minLength":1,"type":"string"},"currency":{"maxLength":4000,"minLength":1,"type":"string"},"offerIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"oldPrice":{"type":"number"},"price":{"minimum":0.01,"type":"number"},"productIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"scopeConfirmed":{"type":"boolean"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"},"userRequest":{"description":"本轮用户明确修改指令原话","maxLength":4000,"minLength":1,"type":"string"},"valueSource":{"description":"user 或 rule:规则名，不允许猜测数值","maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"input":{"additionalProperties":true,"type":"object"},"items":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"kind":{"minLength":1,"type":"string"},"operationId":{"minLength":1,"type":"string"},"state":{"enum":["pending","running","succeeded","failed","partial","unknown"]},"storeId":{"type":"string"},"targets":{"items":{"minLength":1,"type":"string"},"type":"array"}},"required":["operationId","kind","storeId","state","targets","input","items"],"type":"object"}`

### hallmark.products.update_stock @ 1.0.0

修改显式商品清单在指定仓库的库存并只读核实。仅在用户本轮明确要求修改时调用；缺信息必须澄清；unknown 禁止再次写入，先查询操作。

Effect: mutation; completion: readback.

Input: `{"additionalProperties":false,"properties":{"clientOperationKey":{"description":"同一逻辑修改必须复用；未知结果先查询操作","maxLength":4000,"minLength":1,"type":"string"},"offerIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"productIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"scopeConfirmed":{"type":"boolean"},"stock":{"minimum":0,"type":"integer"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"},"userRequest":{"description":"本轮用户明确修改指令原话","maxLength":4000,"minLength":1,"type":"string"},"valueSource":{"description":"user 或 rule:规则名，不允许猜测数值","maxLength":4000,"minLength":1,"type":"string"},"warehouseId":{"maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"additionalProperties":true,"properties":{"input":{"additionalProperties":true,"type":"object"},"items":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"kind":{"minLength":1,"type":"string"},"operationId":{"minLength":1,"type":"string"},"state":{"enum":["pending","running","succeeded","failed","partial","unknown"]},"storeId":{"type":"string"},"targets":{"items":{"minLength":1,"type":"string"},"type":"array"}},"required":["operationId","kind","storeId","state","targets","input","items"],"type":"object"}`

### hallmark.profit.compute @ 1.0.0

调用 Hallmark 参考利润计算；并非实际结算，缺成本单列

Effect: compute; completion: response.

Input: `{"additionalProperties":false,"properties":{"offerIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"productIds":{"items":{"maxLength":4000,"minLength":1,"type":"string"},"maxItems":200,"minItems":1,"type":"array"},"store":{"description":"名称/别名，匹配不唯一须澄清","maxLength":4000,"minLength":1,"type":"string"},"storeId":{"description":"用户明确指定的店铺 ID","maxLength":4000,"minLength":1,"type":"string"}},"required":[],"type":"object"}`

Output: `{"anyOf":[{"additionalProperties":true,"properties":{"products":{"items":{"additionalProperties":true,"type":"object"},"type":"array"},"total":{"minimum":0,"type":"integer"}},"required":["products","total"],"type":"object"},{"additionalProperties":true,"properties":{"spill":{"additionalProperties":true,"properties":{"bytes":{"minimum":0,"type":"integer"},"cursor":{"type":"string"},"path":{"minLength":1,"type":"string"},"summary":{"additionalProperties":true,"type":"object"}},"required":["path","bytes","summary","cursor"],"type":"object"},"storeId":{"minLength":1,"type":"string"},"total":{"minimum":0,"type":"integer"}},"required":["spill","storeId","total"],"type":"object"}]}`

### hallmark.stores.list @ 1.0.0

列出已配置店铺，保留原始字段

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{},"required":[],"type":"object"}`

Output: `{"items":{"additionalProperties":true,"anyOf":[{"required":["id"]},{"required":["storeId"]},{"required":["store_id"]}],"properties":{"id":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"},"store_id":{"minLength":1,"type":"string"}},"type":"object"},"type":"array"}`

### hallmark.stores.resolve @ 1.0.0

唯一解析店铺；多个返回候选

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"query":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["query"],"type":"object"}`

Output: `{"additionalProperties":true,"anyOf":[{"required":["id"]},{"required":["storeId"]},{"required":["store_id"]}],"properties":{"id":{"minLength":1,"type":"string"},"storeId":{"minLength":1,"type":"string"},"store_id":{"minLength":1,"type":"string"}},"type":"object"}`

### notes.notes.create @ 1.0.0

create 本地 Notes 原始笔记；按精确连接与资源身份执行。

Effect: mutation; completion: response.

Input: `{"additionalProperties":false,"properties":{"content":{"maxLength":1000000,"type":"string"},"id":{"maxLength":4000,"minLength":1,"type":"string"},"title":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["title","content"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"note":{"additionalProperties":false,"properties":{"content":{"maxLength":1000000,"type":"string"},"createdAt":{"format":"date-time","type":"string"},"id":{"maxLength":4000,"minLength":1,"type":"string"},"revision":{"pattern":"^[1-9][0-9]*$","type":"string"},"title":{"maxLength":4000,"minLength":1,"type":"string"},"updatedAt":{"format":"date-time","type":"string"}},"required":["id","title","content","revision","createdAt","updatedAt"],"type":"object"},"resource":{"additionalProperties":false,"properties":{"appId":{"const":"notes"},"connectionId":{"maxLength":4000,"minLength":1,"type":"string"},"resourceId":{"maxLength":4000,"minLength":1,"type":"string"},"resourceType":{"const":"note"},"revision":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["appId","connectionId","resourceType","resourceId","revision"],"type":"object"}},"required":["note","resource"],"type":"object"}`

### notes.notes.get @ 1.0.0

get 本地 Notes 原始笔记；按精确连接与资源身份执行。

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"id":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["id"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"note":{"additionalProperties":false,"properties":{"content":{"maxLength":1000000,"type":"string"},"createdAt":{"format":"date-time","type":"string"},"id":{"maxLength":4000,"minLength":1,"type":"string"},"revision":{"pattern":"^[1-9][0-9]*$","type":"string"},"title":{"maxLength":4000,"minLength":1,"type":"string"},"updatedAt":{"format":"date-time","type":"string"}},"required":["id","title","content","revision","createdAt","updatedAt"],"type":"object"},"resource":{"additionalProperties":false,"properties":{"appId":{"const":"notes"},"connectionId":{"maxLength":4000,"minLength":1,"type":"string"},"resourceId":{"maxLength":4000,"minLength":1,"type":"string"},"resourceType":{"const":"note"},"revision":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["appId","connectionId","resourceType","resourceId","revision"],"type":"object"}},"required":["note","resource"],"type":"object"}`

### notes.notes.list @ 1.0.0

list 本地 Notes 原始笔记；按精确连接与资源身份执行。

Effect: query; completion: response.

Input: `{"additionalProperties":false,"properties":{"cursor":{"pattern":"^(0|[1-9][0-9]*)$","type":"string"},"limit":{"maximum":200,"minimum":1,"type":"integer"},"query":{"maxLength":4000,"type":"string"}},"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"completeness":{"enum":["complete","partial"]},"items":{"items":{"additionalProperties":false,"properties":{"note":{"additionalProperties":false,"properties":{"content":{"maxLength":1000000,"type":"string"},"createdAt":{"format":"date-time","type":"string"},"id":{"maxLength":4000,"minLength":1,"type":"string"},"revision":{"pattern":"^[1-9][0-9]*$","type":"string"},"title":{"maxLength":4000,"minLength":1,"type":"string"},"updatedAt":{"format":"date-time","type":"string"}},"required":["id","title","content","revision","createdAt","updatedAt"],"type":"object"},"resource":{"additionalProperties":false,"properties":{"appId":{"const":"notes"},"connectionId":{"maxLength":4000,"minLength":1,"type":"string"},"resourceId":{"maxLength":4000,"minLength":1,"type":"string"},"resourceType":{"const":"note"},"revision":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["appId","connectionId","resourceType","resourceId","revision"],"type":"object"}},"required":["note","resource"],"type":"object"},"type":"array"},"nextCursor":{"type":["string","null"]},"returned":{"minimum":0,"type":"integer"},"total":{"minimum":0,"type":"integer"}},"required":["items","total","returned","nextCursor","completeness"],"type":"object"}`

### notes.notes.update @ 1.0.0

update 本地 Notes 原始笔记；按精确连接与资源身份执行。

Effect: mutation; completion: response.

Input: `{"additionalProperties":false,"anyOf":[{"required":["title"]},{"required":["content"]}],"properties":{"content":{"maxLength":1000000,"type":"string"},"id":{"maxLength":4000,"minLength":1,"type":"string"},"title":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["id"],"type":"object"}`

Output: `{"additionalProperties":false,"properties":{"note":{"additionalProperties":false,"properties":{"content":{"maxLength":1000000,"type":"string"},"createdAt":{"format":"date-time","type":"string"},"id":{"maxLength":4000,"minLength":1,"type":"string"},"revision":{"pattern":"^[1-9][0-9]*$","type":"string"},"title":{"maxLength":4000,"minLength":1,"type":"string"},"updatedAt":{"format":"date-time","type":"string"}},"required":["id","title","content","revision","createdAt","updatedAt"],"type":"object"},"resource":{"additionalProperties":false,"properties":{"appId":{"const":"notes"},"connectionId":{"maxLength":4000,"minLength":1,"type":"string"},"resourceId":{"maxLength":4000,"minLength":1,"type":"string"},"resourceType":{"const":"note"},"revision":{"maxLength":4000,"minLength":1,"type":"string"}},"required":["appId","connectionId","resourceType","resourceId","revision"],"type":"object"}},"required":["note","resource"],"type":"object"}`
