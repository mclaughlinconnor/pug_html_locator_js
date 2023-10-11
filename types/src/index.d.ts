/**
 * @param {number} index
 * @param {State} state
 * @returns {number}
 */
export function htmlLocationToPugLocation(index, state): number;
/**
 * @param {number} index
 * @param {State} state
 * @returns {number}
 */
export function pugLocationToHtmlLocation(index, state): number;
export function parse(input: string): State;
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
