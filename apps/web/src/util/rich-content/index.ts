import type { Descendant, TElement, TText, Value } from 'platejs';
import type { RichContent } from '@/type/rich-content';

export function createRichContent(text = ''): RichContent {
  return { schemaVersion: 1, blocks: text.split('\n').map((text) => ({ type: 'paragraph', children: [{ text }] })) };
}

export function isRichContent(value: unknown): value is RichContent {
  const isNode = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    if ('text' in node) return typeof node.text === 'string' && !('children' in node);
    return (
      'type' in node &&
      typeof node.type === 'string' &&
      'children' in node &&
      Array.isArray(node.children) &&
      node.children.length > 0 &&
      node.children.every(isNode)
    );
  };
  return (
    !!value &&
    typeof value === 'object' &&
    'schemaVersion' in value &&
    value.schemaVersion === 1 &&
    'blocks' in value &&
    Array.isArray(value.blocks) &&
    value.blocks.length > 0 &&
    value.blocks.every((node) => isNode(node) && 'children' in node)
  );
}

// 이전 모의 데이터의 문자열 본문도 서식을 없애지 않고 편집할 수 있게 이행한다.
export function normalizeRichContent(value: RichContent | string): RichContent {
  return typeof value === 'string' ? createRichContent(value) : value;
}

function textOf(node: Descendant): string {
  if (typeof node.text === 'string') return node.text;
  const element = node as TElement;
  const separator = ['table', 'tr', 'ul', 'ol', 'li'].includes(element.type) ? '\n' : '';
  return element.children.map(textOf).join(separator);
}
export function getRichText(value: RichContent): string {
  return value.blocks.map(textOf).join('\n');
}

function mapNodes(nodes: Descendant[], paragraph: string): Descendant[] {
  return nodes.map((node) => {
    if ('text' in node) return { ...node };
    const { id: _id, ...rest } = node;
    return {
      ...rest,
      type: ['p', 'paragraph'].includes(node.type) ? paragraph : node.type,
      children: mapNodes(node.children, paragraph),
    };
  });
}
export function toEditorValue(value: RichContent): Value {
  return mapNodes(value.blocks, 'p') as Value;
}
export function fromEditorValue(value: Value): RichContent {
  return { schemaVersion: 1, blocks: mapNodes(value, 'paragraph') as Value };
}
function isPlainContent(value: RichContent) {
  return value.blocks.every(
    (block) =>
      ['p', 'paragraph'].includes(block.type) &&
      block.children.every(
        (child) =>
          typeof child.text === 'string' &&
          Object.entries(child).every(([key, value]) => key === 'text' || value === false || value === undefined)
      )
  );
}
export function sameRichContent(left: RichContent, right: RichContent) {
  // 일반 텍스트 붙여넣기의 줄바꿈과 여러 문단은 같은 입력으로 비교한다.
  if (isPlainContent(left) && isPlainContent(right)) return getRichText(left) === getRichText(right);
  return JSON.stringify(fromEditorValue(left.blocks)) === JSON.stringify(fromEditorValue(right.blocks));
}
export function isHttpUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** 서식으로 나뉜 텍스트에서도 날짜를 치환하며 링크 주소·블록·서식은 보존한다. */
export function replaceRichText(value: RichContent, replacements: [string, string][]): RichContent {
  const result = structuredClone(value);
  for (const block of result.blocks) {
    const leaves: TText[] = [];
    const collect = (node: TElement | TText) => {
      if (typeof node.text === 'string') leaves.push(node as TText);
      else (node as TElement).children.forEach(collect);
    };
    collect(block);
    for (const [search, replacement] of replacements) {
      const text = leaves.map((leaf) => leaf.text).join('');
      const offsets = leaves.map((_leaf, index) =>
        leaves.slice(0, index).reduce((sum, item) => sum + item.text.length, 0)
      );
      const matches = [...text.matchAll(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
      for (const match of matches.reverse()) {
        const start = match.index!;
        const end = start + search.length;
        leaves.forEach((leaf, index) => {
          const offset = offsets[index];
          const originalLength = (offsets[index + 1] ?? text.length) - offset;
          if (offset >= end || offset + originalLength <= start) return;
          const from = Math.max(0, start - offset);
          const to = Math.min(originalLength, end - offset);
          leaf.text = leaf.text.slice(0, from) + (offset <= start ? replacement : '') + leaf.text.slice(to);
        });
      }
    }
  }
  return result;
}
