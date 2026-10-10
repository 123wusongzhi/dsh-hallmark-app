import test from 'node:test';
import assert from 'node:assert/strict';
import { listingImageQuestions } from '../../packages/app-hallmark/src/listing-image-review.ts';
import { BUSINESS_DESCRIPTORS } from '../../packages/app-hallmark/src/operations-provider.ts';

test('fixed image questions scope specification text to primary image and keep no-text outcomes not applicable', () => {
  const questions = listingImageQuestions({ primaryImage: { id: 'draft-1', field: 'primary_image' }, draftImages: [{ id: 'draft-0', field: 'images[0]' }, { id: 'draft-1', field: 'primary_image' }], referenceImageIds: ['source-4'] });
  assert.equal(questions.length, 5);
  const spec = questions.find(q => q.id === 'image-specification-text')!;
  assert.deepEqual(spec.imageIds, ['draft-1']);
  assert.equal(spec.issue?.field, 'primary_image');
  assert.equal(spec.choices?.no_spec_text.status, 'passed');
  assert.equal(spec.choices?.no_spec_text.applicable, false);
  assert.match(spec.instructions, /没有规格文字必须选 no_spec_text/);
  assert.match(spec.instructions, /禁止从外观推断尺寸/);
  assert.match(spec.instructions, /禁止数格子/);
  for (let i = 0; i < 2; i++) {
    const clarity = questions.find(q => q.id === `image-text-legibility:draft-${i}`)!;
    assert.deepEqual(clarity.imageIds, [`draft-${i}`]);
    assert.equal(clarity.choices?.no_text.status, 'passed');
    assert.equal(clarity.choices?.no_text.applicable, false);
    const subject = questions.find(q => q.id === `image-subject-consistency:draft-${i}`)!;
    assert.deepEqual(subject.imageIds, ['source-4', `draft-${i}`]);
    assert.match(subject.instructions, /多商品或多主体无法确定对应对象时选 evidence_insufficient/);
    assert.match(subject.instructions, /不把短样展示图要求成整卷长度/);
  }
  for (const q of questions) { assert.equal(q.version, '1'); assert.equal(q.choices?.evidence_insufficient.status, 'pending'); }
});

test('rich content alone cannot silently become a primary image or fabricate source images', () => {
  const questions = listingImageQuestions({ draftImages: [{ id: 'draft-0', field: 'attributes.rich_content.images' }], referenceImageIds: [] });
  assert.deepEqual(questions[0].imageIds, []);
  assert.deepEqual(questions.at(-1)!.imageIds, ['draft-0']);
  assert.equal(questions.at(-1)!.choices?.evidence_insufficient.status, 'pending');
});

test('draft create and revise accept only simple application-owned reference subject data outside Ozon payload', () => {
  for (const operation of ['create', 'revise']) {
    const descriptor = BUSINESS_DESCRIPTORS.find(d => d.capabilityId === `hallmark.plan.${operation}`)!;
    const schema = descriptor.inputSchema as any;
    const subjects = schema.properties.rows.items.properties.referenceSubjects;
    assert.deepEqual(subjects.items.required, ['sourceImageUrl', 'subject']);
    assert.deepEqual(Object.keys(subjects.items.properties), ['sourceImageUrl', 'subject']);
    assert.equal(subjects.items.additionalProperties, false);
    assert.equal(subjects.maxItems, 8);
  }
});
