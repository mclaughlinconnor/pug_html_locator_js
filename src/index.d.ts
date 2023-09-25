/**
 * @param {string} input
 * @returns {State}
 */
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
//# sourceMappingURL=index.d.ts.map