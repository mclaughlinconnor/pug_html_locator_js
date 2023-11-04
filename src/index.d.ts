export function rangeAtPugLocation(index: number, state: State): Range;
export function rangeAtHtmlLocation(index: number, state: State): Range;
export function rangeAtHtmlLocation(index: number, state: State): Range;
export function htmlLocationToPugLocation(index: number, state: State): number;
export function pugLocationToHtmlLocation(index: number, state: State): number;
export function parse(input: string): State;
export type Range = {
  htmlEnd: number;
  htmlStart: number;
  nodeType?: keyof typeof NodeType;
  pugEnd: number;
  pugStart: number;
};
export type State = {
  htmlText: string;
  pugText: string;
  ranges: Range[];
};
declare const NodeType: {
  ATTRIBUTE: 'ATTRIBUTE',
  ATTRIBUTE_NAME: 'ATTRIBUTE_NAME',
  CONTENT: 'CONTENT',
  EMPTY: 'EMPTY',
  EQUALS: 'EQUALS',
  FILENAME: 'FILENAME',
  ID_CLASS: 'ID_CLASS',
  JAVASCRIPT: 'JAVASCRIPT',
  SPACE: 'SPACE',
  TAG: 'TAG',
  TAG_NAME: 'TAG_NAME',
}
