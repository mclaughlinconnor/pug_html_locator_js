export function htmlLocationToPugLocation(index: number, state: State): number;
export function pugLocationToHtmlLocation(index: number, state: State): number;
export function parse(input: string): State;
export type Range = {
    htmlEnd: number;
    htmlStart: number;
    pugEnd: number;
    pugStart: number;
};
export type State = {
    htmlText: string;
    pugText: string;
    ranges: Range[];
};
