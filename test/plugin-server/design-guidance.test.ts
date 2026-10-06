import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_CAPABILITIES, DESIGN_INSTRUCTIONS, designToolDescription } from '../../packages/dsh-plugin/server/design-guidance.ts';
import { TOOL_DEFINITIONS, validate } from '../../packages/contracts/src/index.ts';
import { assertJsonCompatible } from '../../packages/contracts/src/json.ts';
import { applyPatch } from '../../packages/presentation/src/patch.ts';
import { validateViewSpec, WIDGET_TYPES } from '../../packages/presentation/src/validation.ts';
import { toRenderSpec } from '../../packages/dsh-plugin/client/render-catalog.ts';

test('design recipes execute within existing ViewSpec, render catalog and service parameter contracts',()=>{
  const render=TOOL_DEFINITIONS.find(tool=>tool.name==='hallmark_render_view')!;
  assert.deepEqual(DESIGN_CAPABILITIES.widgets,WIDGET_TYPES);
  assert.equal(DESIGN_CAPABILITIES.recipes.length,3);
  assertJsonCompatible(DESIGN_CAPABILITIES);
  for(const recipe of DESIGN_CAPABILITIES.recipes){
    const spec=structuredClone(recipe.spec);
    assert.equal(spec.templateId,undefined,'recipe IDs must not pretend to be installed templates');
    assert.equal(spec.bindings.length,1);
    assert.match(spec.bindings[0].datasetKey!,/REPLACE_WITH_/,'no fake usable business dataset');
    spec.id='new-'+recipe.recipeId;
    spec.bindings[0].datasetKey=recipe.recipeId==='operation-receipt'?'operation:actual-operation':'collected:actual-query';
    if(recipe.recipeId==='observed-trend')spec.bindings[0].fieldMap={x:'observedAt',y:'amount'};
    validateViewSpec(spec);
    assert.doesNotThrow(()=>toRenderSpec(spec));
    assert.deepEqual(validate(render.parameters,{spec}),[]);
    assert.ok(spec.widgets.every(widget=>widget.type==='text'||widget.bindingId===spec.bindings[0].id));
  }
});

test('documented edit preserves binding and identity and rejects a stale widget path',()=>{
  const spec=DESIGN_CAPABILITIES.recipes[0].spec;
  const original=JSON.stringify(spec);
  const example=DESIGN_CAPABILITIES.editExample.arguments;
  const update=TOOL_DEFINITIONS.find(tool=>tool.name==='hallmark_update_view')!;
  assert.deepEqual(validate(update.parameters,example),[]);
  const edited=applyPatch(spec,example.patch);
  validateViewSpec(edited);
  assert.equal(edited.id,spec.id);
  assert.deepEqual(edited.bindings,spec.bindings);
  assert.equal(edited.widgets[0].options?.pageSize,20);
  assert.equal(JSON.stringify(spec),original);
  const changed=structuredClone(spec);
  changed.widgets[0].id='different';changed.layout.children=['different'];
  assert.throws(()=>applyPatch(changed,example.patch),/test failed/);
});

test('Host guidance enriches only design tools and never mutates exact shared catalog',()=>{
  const before=JSON.stringify(TOOL_DEFINITIONS);
  const enhanced=new Set(['hallmark_app_info','hallmark_render_view','hallmark_update_view']);
  for(const descriptor of TOOL_DEFINITIONS){
    const frozen=Object.freeze(structuredClone(descriptor));
    const description=designToolDescription(frozen);
    assert.ok(description.startsWith(descriptor.description));
    if(enhanced.has(descriptor.name))assert.match(description,/designCapabilities/);
    else assert.equal(description,descriptor.description);
  }
  assert.equal(JSON.stringify(TOOL_DEFINITIONS),before);
  assert.match(DESIGN_INSTRUCTIONS,/data\.designCapabilities/);
  assert.match(DESIGN_INSTRUCTIONS,/实际渲染截图/);
  // The capability payload must fit the ordinary model-content budget with room for app-info fields.
  assert.ok(Buffer.byteLength(JSON.stringify(DESIGN_CAPABILITIES))<11_000);
});
