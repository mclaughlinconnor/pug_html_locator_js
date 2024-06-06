const Parser = require("tree-sitter");
const Pug = require("tree-sitter-pug");

const NodeType = {
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
};
module.exports.NodeType = NodeType;

/**
 * @param {number} index
 * @param {State} state
 * @returns {Range}
 */
module.exports.rangeAtPugLocation = function rangeAtPugLocation(index, state) {
  for (const range of state.ranges) {
    if (range.pugStart <= index && index <= range.pugEnd) {
      return range;
    }
  }
}

/**
 * @param {number} index
 * @param {State} state
 * @returns {Range}
 */
module.exports.rangeAtHtmlLocation = function rangeAtHtmlLocation(index, state) {
  for (const range of state.ranges) {
    if (range.htmlStart <= index && index <= range.htmlEnd) {
      return range;
    }
  }
}

/**
 * @param {number} index
 * @param {State} state
 * @returns {number}
 */
module.exports.htmlLocationToPugLocation = function htmlLocationToPugLocation(index, state) {
  let closest;
  for (const range of state.ranges) {
    if (range.htmlStart <= index && index <= range.htmlEnd) {
      return Math.min(range.pugStart + (index - range.htmlStart), state.pugText.length);
    }

    if (!closest && range.htmlEnd > index) {
      closest = range;
    }
  }

  return Math.min(closest.pugStart + (index - closest.htmlStart), state.pugText.length);
}

/**
 * @param {number} index
 * @param {State} state
 * @returns {number}
 */
module.exports.pugLocationToHtmlLocation = function pugLocationToHtmlLocation(index, state) {
  let closest;
  for (const range of state.ranges) {
    if (range.pugStart <= index && index <= range.pugEnd) {
      return Math.min(range.htmlStart + (index - range.pugStart), state.htmlText.length);
    }

    if (!closest && range.pugEnd > index) {
      closest = range;
    }
  }

  return Math.min(closest.htmlStart + (index - closest.pugStart), state.htmlText.length);
}

/**
 * @param {Parser.SyntaxNode} node
 * @returns {Parser.Range}
 */
function getRange(node) {
  return {
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startPosition: node.startPosition,
    endPosition: node.endPosition,
  };
}

function offsetPreviousRange(state, offset) {
  const lastRange = state.ranges[state.ranges.length - 1];
  if (lastRange) {
    return {startIndex: lastRange.pugEnd + offset, endIndex: lastRange.pugEnd + offset};
  }

  return {startIndex: 0, endIndex: 0};
}

/**
 * @param {string} tag_name
 * @returns {boolean}
 */
function isVoidElement(tag_name) {
  switch (tag_name) {
    case "area":
    case "base":
    case "br":
    case "col":
    case "embed":
    case "hr":
    case "img":
    case "input":
    case "link":
    case "meta":
    case "param":
    case "source":
    case "track":
    case "wbr":
      return true;
    default:
      return false;
  }
}

/**
 * @param {string} input
 * @returns {State}
 */
module.exports.parse = function parse(input) {
  const parser = new Parser();

  parser.setLanguage(Pug);
  const tree = parser.parse(input);

  let rootNode = tree.rootNode;

  let state = {
    htmlText: "",
    pugText: input,
    ranges: [],
  };

  traverseTree(rootNode, state);

  state.htmlText += "\n";

  state.ranges.push(
    {
      htmlStart: state.htmlText.length - 1,
      htmlEnd: state.htmlText.length,
      pugStart: (state.ranges[state.ranges.length - 1]?.pugEnd || 0) + 1,
      pugEnd: state.pugText.length,
    }
  )

  return state;
}

/**
 * @returns {void} */
module.exports.demo = function demo() {
  const parser = new Parser();

  let pugInput = "input.form-control([placeholder]=`hello`)\n";

  parser.setLanguage(Pug);
  const tree = parser.parse(pugInput);

  let rootNode = tree.rootNode;

  let state = {
    htmlText: "",
    pugText: pugInput,
    ranges: [],
  };

  traverseTree(rootNode, state);

  console.log(pugInput);
  console.log(rootNode.toString());
  console.log("{}", state.htmlText);
  for (const range of state.ranges) {
    console.log(
      `'${state.htmlText.substring(
        range.htmlStart,
        range.htmlEnd,
      )}' => '${state.pugText.substring(range.pugStart, range.pugEnd)}': ${range.nodeType}`,
    );
  }
}

/**
 * @param {State} state
 * @param {string} toPush
 * @param {keyof NodeType} [nodeType]
 * @param {Parser.Range} [pugRange]
 * @returns {void}
 */
function pushRange(state, toPush, nodeType, pugRange) {
  if (pugRange) {
    let htmlLen = state.htmlText.length;


    let range = {
      htmlStart: htmlLen,
      htmlEnd: htmlLen + toPush.length,
      nodeType: nodeType,
      pugStart: pugRange.startIndex,
      pugEnd: pugRange.endIndex,
    };

    state.ranges.push(range);
  }

  state.htmlText += toPush;
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitJavascript(node, state) {
  let text = node.text

  const nRanges = state.ranges.length - 1
  const isAttribute = nRanges >= 2 && state.ranges[nRanges].nodeType == NodeType.EQUALS && state.ranges[nRanges-1].nodeType == NodeType.ATTRIBUTE_NAME
  const isTemplateString = text.includes('`')
  const r = getRange(node)

  let quote = "'"
  if (text.includes("'")) {
    quote = "\""
  }

  if (nRanges < 1 || !isAttribute) {
    pushRangeSurround(state, text, r, quote, NodeType.JAVASCRIPT)
    return
  }

  if (isTemplateString) {
    text = text.replaceAll("`", "")
    pushRange(state, `"$any('`)
    pushRange(state, text, NodeType.JAVASCRIPT, r)
    pushRange(state, `')"`)
  } else {
    pushRangeSurround(state, text, r, quote, NodeType.JAVASCRIPT)
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitAttributeName(node, state) {
  pushRange(state, node.text, NodeType.ATTRIBUTE_NAME, getRange(node));
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitAttributes(node, state) {
  for (const [i, attribute] of node.namedChildren.entries()) {
    let children = attribute.namedChildren;

    let index = 0;

    let attributeName = children[index];
    if (!attributeName) {
      continue;
    }

    visitAttributeName(attributeName, state);

    index++;
    let attributeValue = children[index];

    if (attributeValue) {
      const r = offsetPreviousRange(state, 1)
      pushRange(state, "=", NodeType.EQUALS, r);
      traverseTree(attributeValue, state);
    } else if (attribute.nextSibling?.text === "=") {
      // if "attr=" has been typed, we still want the = in case that's where the cursor is
      pushRange(state, "=", NodeType.EQUALS, offsetPreviousRange(state, 1));
    }

    const lastRange = state.ranges[state.ranges.length - 1];
    let spaceEnd = (lastRange?.pugEnd || 0) + 1;
    let node = attribute.nextSibling;
    while (node) {
      if (node.text === ',' || node.type === 'ERROR') {
        pushRange(state, " ", NodeType.SPACE, {startIndex: spaceEnd + 1, endIndex: node.startIndex});
      } else if (node.text === ')' || node.isNamed) {
        spaceEnd = node.isNamed ? node.startIndex - 1 : node.startIndex;
        break;
      }

      node = node.nextSibling;
    }

    pushRange(state, " ", NodeType.SPACE, {startIndex: (state.ranges[state.ranges.length - 1]?.pugEnd || 0) + 1, endIndex: spaceEnd});
  }
}

/**
 * @param {State} state
 * @param {string} toPush
 * @param {Parser.Range} pugRange
 * @param {string} surround
 * @param {keyof NodeType} nodeType
 * @returns {void}
 */
function pushRangeSurround(state, toPush, pugRange, surround, nodeType) {
  pushRange(state, surround);
  pushRange(state, toPush, nodeType, pugRange);
  pushRange(state, surround);
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitTagName(node, state) {
  const pugRange = getRange(node);
  const htmlLen = state.htmlText.length;
  const toPush = node.text;

  const range = {
    htmlStart: htmlLen,
    htmlEnd: htmlLen + toPush.length,
    nodeType: NodeType.TAG_NAME,
    pugStart: pugRange.startIndex,
    pugEnd: pugRange.endIndex,
  };

  state.ranges.push(range);
  state.htmlText += toPush;
}

/**
 * @param {Parser.SyntaxNode[]} nodes
 * @param {State} state
 * @returns {void}
 */
function visitIdClass(nodes, state) {
  let start = true;

  for (const node of nodes) {
    if (!start) {
      pushRange(state, " ");
    }

    let range = getRange(node);
    range.startIndex += 1;
    let text = node.text.substring(1);

    pushRange(state, text, NodeType.ID_CLASS, range);

    start = false;
  }
}

function handleClosingTagName(state, nameNode) {
  let offset = 0;
  if (isVoidElement(nameNode.text)) {
    pushRange(state, "/");
    pushRange(state, "", NodeType.EMPTY, offsetPreviousRange(state, -1));
    offset--;
  }
  pushRange(state, ">");
  pushRange(state, "", NodeType.EMPTY, offsetPreviousRange(state, offset));
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitTag(node, state) {
  let childNodes = node.namedChildren;

  let nameNode;

  let handledClosingTagName = false;

  let classes = [];
  let ids = [];


  if (childNodes[0].type === "tag_name") {
    const startRange = getRange(childNodes[0]);
    startRange.endIndex = startRange.startIndex;
    startRange.endPosition = startRange.startPosition;
    pushRange(state, "", NodeType.EMPTY, startRange);
    pushRange(state, "<");

    traverseTree(childNodes[0], state);
    nameNode = childNodes[0];
  } else {
    pushRange(state, "<");
    pushRange(state, "div");
    nameNode = {text: 'div'}
  }

  for (const childNode of childNodes) {
    if (childNode.type == "tag_name") {
      continue;
    }

    if (childNode.type == "class") {
      classes.push(childNode);
      continue;
    }

    if (childNode.type == "id") {
      ids.push(childNode);
      continue;
    }

    if (childNode.type == "attributes") {
      hasAttributes = true;
      if (classes.length) {
        pushRange(state, ' class="');
        visitIdClass(classes, state);
        pushRange(state, '"');
      }

      if (ids.length) {
        pushRange(state, ' id="');
        visitIdClass(ids, state);
        pushRange(state, '"');
      }

      pushRange(state, " ", NodeType.SPACE, offsetPreviousRange(state, 0));
      traverseTree(childNode, state);
      // if (!childNode.isNamed) {
        pushRange(state, " ", NodeType.SPACE, getRange(childNode.lastChild));
      // }

      continue;
    }

    handleClosingTagName(state, nameNode);
    handledClosingTagName = true;

    // found something else that needs no extra handling
    traverseTree(childNode, state);
  }

  if (!handledClosingTagName) {
    handleClosingTagName(state, nameNode);
  }

  if (!isVoidElement(nameNode.text)) {
    pushRange(state, "</");
    pushRange(state, nameNode.text);
    pushRange(state, ">");
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitConditional(node, state) {
  let conditionalCursor = node.walk();

  conditionalCursor.gotoFirstChild();
  conditionalCursor.gotoNextSibling();

  if (conditionalCursor.currentNode.type == "javascript") {
    let condition = conditionalCursor.currentNode;

    pushRange(state, "<script>return ");
    pushRange(state, condition.text, NodeType.JAVASCRIPT, getRange(condition));
    pushRange(state, ";</script>");
    conditionalCursor.gotoNextSibling();
  }

  conditionalCursor.gotoNextSibling();

  let children = conditionalCursor.currentNode.namedChildren;
  for (const child of children) {
    traverseTree(child, state);
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitPipe(node, state) {
  let cursor = node.walk();

  cursor.gotoFirstChild();
  while (cursor.gotoNextSibling()) {
    if (cursor.currentNode.isNamed) {
      traverseTree(cursor.currentNode, state);
    }
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitTagInterpolation(node, state) {
  let interpolationCursor = node.walk();

  interpolationCursor.gotoFirstChild();
  interpolationCursor.gotoNextSibling();
  let children = interpolationCursor.currentNode.namedChildren;

  for (const child of children) {
    traverseTree(child, state);
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitFilename(node, state) {
  pushRange(state, '<a href="');
  pushRange(state, node.text, NodeType.FILENAME, getRange(node));
  pushRange(state, '">');
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitExtendsInclude(node, state) {
  for (const child of node.namedChildren) {
    traverseTree(child, state);
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitCaseWhen(node, state) {
  let children = node.namedChildren;
  for (const child of children) {
    if (child.type == "javascript") {
      pushRange(state, "<script>return ");
      pushRange(state, child.text, NodeType.JAVASCRIPT, getRange(child));
      pushRange(state, ";</script>");
    } else {
      traverseTree(child, state);
    }
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitUnbufferedCode(node, state) {
  for (const child of node.namedChildren) {
    if (child.type == "javascript") {
      pushRange(state, "<script>");
      pushRange(state, child.text, NodeType.JAVASCRIPT, getRange(child));
      pushRange(state, ";</script>");
    } else {
      traverseTree(child, state);
    }
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitMixinDefinition(node, state) {
  if (node.namedChildren.length === 2) {
    return;
  }

  let index = 2; // skip the keyword and the name


  pushRange(state, "<ng-template ")

  if (node.namedChildren[index]?.type === 'mixin_attributes') {
    const attributes = node.namedChildren[index];
    for (const attribute of attributes.namedChildren) {
      pushRange(state, "let-");
      pushRange(state, attribute.text, NodeType.ATTRIBUTE, getRange(attribute));
      pushRange(state, " ");
    }
    index++;
  }

  pushRange(state, ">");

  // Should just be the mixin content now
  traverseTree(node.namedChildren[index], state);

  pushRange(state, "</ng-template>")
}


/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function visitBufferedCode(node, state) {
  for (const child of node.namedChildren) {
    if (child.type == "javascript") {
      pushRange(state, "<script>return ");
      pushRange(state, child.text, NodeType.JAVASCRIPT, getRange(child));
      pushRange(state, ";</script>");
    } else {
      traverseTree(child, state);
    }
  }
}

/**
 * @param {Parser.SyntaxNode} node
 * @param {State} state
 * @returns {void}
 */
function traverseTree(node, state) {
  let nodeType = node.type;

  if (node.isNamed) {
    switch (nodeType) {
      case "source_file":
      case "children":
      case "block_definition":
      case "block_use":
      case "each": {
        let children = node.namedChildren;
        for (const child of children) {
          traverseTree(child, state);
        }
        break;
      }
      case "mixin_definition": {
        visitMixinDefinition(node, state);
        break;
      }
      case "iteration_variable":
      case "iteration_iterator": {
        for (const child of node.namedChildren) {
          if (child.type == "javascript") {
            pushRange(state, "<script>return ");
            pushRange(state, child.text, NodeType.JAVASCRIPT, getRange(child));
            pushRange(state, ";</script>");
          } else {
            traverseTree(child, state);
          }
        }
        break;
      }
      case "script_block": {
        for (const child of node.namedChildren) {
          if (child.type == "javascript") {
            pushRange(state, "<script>");
            pushRange(state, child.text, NodeType.JAVASCRIPT, getRange(child));
            pushRange(state, ";</script>");
          } else {
            traverseTree(child, state);
          }
        }
        break;
      }
      case "unbuffered_code": {
        visitUnbufferedCode(node, state);
        break;
      }
      case "buffered_code":
      case "unescaped_buffered_code": {
        visitBufferedCode(node, state);
        break;
      }
      case "escaped_string_interpolation": {
        let interpolationContent = node.namedChildren[1];
        if (interpolationContent) {
          let text = interpolationContent.text;
          pushRange(state, "<script>return ");
          pushRange(state, text, NodeType.JAVASCRIPT, getRange(interpolationContent));
          pushRange(state, ";</script>");
        }
        break;
      }
      case "when":
      case "case": {
        visitCaseWhen(node, state);
        break;
      }
      case "tag_interpolation": {
        visitTagInterpolation(node, state);
        break;
      }
      case "pipe": {
        visitPipe(node, state);
        break;
      }
      case "conditional": {
        visitConditional(node, state);
        break;
      }
      case "tag":
      case "filter": {
        visitTag(node, state);
        break;
      }
      case "tag_name":
      case "filter_name": {
        visitTagName(node, state);
        break;
      }
      case "attributes": {
        visitAttributes(node, state);
        break;
      }
      case "attribute_name": {
        visitAttributeName(node, state);
        break;
      }
      case "javascript": {
        visitJavascript(node, state)
        break;
      }
      case "quoted_attribute_value": {
        pushRange(state, node.text, NodeType.ATTRIBUTE, getRange(node));
        break;
      }
      case "content": {
        for (const interpolation of node.namedChildren) {
          traverseTree(interpolation, state);
        }
        // Always traverse the whole content after we've traversed the interpolation, so they
        // appear after in the conversion ranges
        pushRange(state, node.text, NodeType.CONTENT, getRange(node));
        break;
      }
      case "extends":
      case "include": {
        visitExtendsInclude(node, state);
        break;
      }
      case "filename": {
        visitFilename(node, state);
        break;
      }
      case "keyword":
      case "mixin_attributes":
      case "comment":
      case "block_name": {
        break;
      }
      case "ERROR": {
        for (const interpolation of node.namedChildren) {
          traverseTree(interpolation, state);
        }
        break;
      }
      default: {
        // Unhandled node type
      }
    }
  }
}

/**
 * @typedef {Object} Range
 * @property {number} htmlEnd
 * @property {number} htmlStart
 * @property {keyof NodeType} nodeType
 * @property {number} pugEnd
 * @property {number} pugStart
 */
/**
 * @typedef {Object} State
 * @property {string} htmlText
 * @property {string} pugText
 * @property {Range[]} ranges
 */
