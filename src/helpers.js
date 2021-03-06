import { NodeSelection } from 'prosemirror-state';
import { Fragment, Node as PMNode } from 'prosemirror-model';
import { setTextSelection } from './transforms';
import { findParentNodeClosestToPos } from './selection';
import { TableMap } from 'prosemirror-tables';

// :: (selection: Selection) → boolean
// Checks if current selection is a `NodeSelection`.
//
// ```javascript
// if (isNodeSelection(tr.selection)) {
//   // ...
// }
// ```
export const isNodeSelection = selection => {
  return selection instanceof NodeSelection;
};

// (nodeType: union<NodeType, [NodeType]>) → boolean
// Checks if the type a given `node` equals to a given `nodeType`.
export const equalNodeType = (nodeType, node) => {
  return (
    (Array.isArray(nodeType) && nodeType.indexOf(node.type) > -1) ||
    node.type === nodeType
  );
};

// (tr: Transaction) → Transaction
// Creates a new transaction object from a given transaction
export const cloneTr = tr => {
  return Object.assign(Object.create(tr), tr).setTime(Date.now());
};

// (position: number, content: union<ProseMirrorNode, Fragment>) → (tr: Transaction) → Transaction
// Returns a `replace` transaction that replaces a node at a given position with the given `content`.
// It will return the original transaction if replacing is not possible.
// `position` should point at the start of a node in the document.
export const replaceNodeAtPos = (position, content) => tr => {
  const before = position - 1;
  const node = tr.doc.nodeAt(before);
  const $pos = tr.doc.resolve(before);
  if (canReplace($pos, content)) {
    tr = tr.replaceWith(before, before + node.nodeSize, content);
    const start = tr.selection.$from.pos - 1;
    return cloneTr(setTextSelection(Math.max(start, 0), -1)(tr));
  }
  return tr;
};

// ($pos: ResolvedPos, doc: ProseMirrorNode, content: union<ProseMirrorNode, Fragment>, ) → boolean
// Checks if replacing a node at a given `$pos` inside of the `doc` node with the given `content` is possible.
export const canReplace = ($pos, content) => {
  const index = $pos.index($pos.depth);
  const indexAfter = $pos.indexAfter($pos.depth);
  const node = $pos.node($pos.depth);
  return (
    node &&
    node.type.validContent(
      content instanceof Fragment ? content : Fragment.from(content)
    )
  );
};

// (position: number) → (tr: Transaction) → Transaction
// Returns a `delete` transaction that removes a node at a given position with the given `node`.
// `position` should point at the start of a node in the document.
export const removeNodeAtPos = position => tr => {
  const before = position - 1;
  const node = tr.doc.nodeAt(before);
  return cloneTr(tr.delete(before, before + node.nodeSize));
};

// (schema: Schema) → {[key: string]: NodeType}
// Returns a map where keys are tableRoles and values are NodeTypes.
export const tableNodeTypes = schema => {
  if (schema.cached.tableNodeTypes) {
    return schema.cached.tableNodeTypes;
  }
  const roles = {};
  Object.keys(schema.nodes).forEach(type => {
    const nodeType = schema.nodes[type];
    if (nodeType.spec.tableRole) {
      roles[nodeType.spec.tableRole] = nodeType;
    }
  });
  schema.cached.tableNodeTypes = roles;
  return roles;
};

// :: ($pos: ResolvedPos, content: union<ProseMirrorNode, Fragment>) → boolean
// Checks if a given `content` can be inserted at the given `$pos`
//
// ```javascript
// const { selection: { $from } } = state;
// const node = state.schema.nodes.atom.createChecked();
// if (canInsert($from, node)) {
//   // ...
// }
// ```
export const canInsert = ($pos, content) => {
  const index = $pos.index();

  if (content instanceof Fragment) {
    return $pos.parent.canReplace(index, index, content);
  } else if (content instanceof PMNode) {
    return $pos.parent.canReplaceWith(index, index, content.type);
  }
  return false;
};

// (node: ProseMirrorNode) → boolean
// Checks if a given `node` is an empty paragraph
export const isEmptyParagraph = node => {
  return !node || (node.type.name === 'paragraph' && node.nodeSize === 2);
};

// ($pos: ResolvedPos) → ?{pos: number, node: ProseMirrorNode}
// Iterates over parent nodes, returning a table node closest to a given `$pos`.
//
// ```javascript
// const table = findTableClosestToPos(state.doc.resolve(10));
// ```
const findTableClosestToPos = $pos => {
  const predicate = node =>
    node.type.spec.tableRole && /table/i.test(node.type.spec.tableRole);
  return findParentNodeClosestToPos($pos, predicate);
};

// :: ($pos: ResolvedPos) → ?{pos: number, node: ProseMirrorNode}
// Iterates over parent nodes, returning a table cell or a table header node closest to a given `$pos`.
//
// ```javascript
// const cell = findCellClosestToPos(state.doc.resolve(10));
// ```
export const findCellClosestToPos = $pos => {
  const predicate = node =>
    node.type.spec.tableRole && /cell/i.test(node.type.spec.tableRole);
  return findParentNodeClosestToPos($pos, predicate);
};

// ($pos: ResolvedPos) → ?{left: number, top: number, right: number, bottom: number}
// Returns the rectangle spanning a cell closest to a given `$pos`.
//
// ```javascript
// dispatch(
//   findCellRectClosestToPos(state.doc.resolve(10))
// );
// ```
export const findCellRectClosestToPos = $pos => {
  const cell = findCellClosestToPos($pos);
  if (cell) {
    const table = findTableClosestToPos($pos);
    const map = TableMap.get(table.node);
    const cellPos = cell.pos - table.pos - 1;
    return map.rectBetween(cellPos, cellPos);
  }
};
