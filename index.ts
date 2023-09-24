import Parser from "tree-sitter";
const Pug = require("./tree-sitter-pug");

interface Range {
  htmlEnd: number;
  htmlStart: number;
  pugEnd: number;
  pugStart: number;
}

interface State {
  htmlText: string;
  pugText: string;
  ranges: Range[];
}

function getRange(node: Parser.SyntaxNode): Parser.Range {
  return {
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startPosition: node.startPosition,
    endPosition: node.endPosition,
  };
}

function isVoidElement(tag_name: string): boolean {
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

function demo() {
  const parser: Parser = new Parser();

  let pugInput = "";

  parser.setLanguage(Pug);
  const tree: Parser.Tree = parser.parse(pugInput);

  let rootNode = tree.rootNode;

  let state: State = {
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
      )}' => '${state.pugText.substring(range.pugStart, range.pugEnd)}'`,
    );
  }
}

function pushRange(state: State, toPush: string, pugRange?: Parser.Range) {
  if (pugRange) {
    let htmlLen = state.htmlText.length;

    let range: Range = {
      htmlStart: htmlLen,
      htmlEnd: htmlLen + toPush.length,
      pugStart: pugRange.startIndex,
      pugEnd: pugRange.endIndex,
    };

    state.ranges.push(range);
  }

  state.htmlText += toPush;
}

function visitAttributeName(node: Parser.SyntaxNode, state: State) {
  pushRange(state, node.text, getRange(node));
}

function visitAttributes(node: Parser.SyntaxNode, state: State) {
  let first = true;

  for (const attribute of node.namedChildren) {
    if (!first) {
      pushRange(state, ", ");
    } else {
      first = false;
    }

    let children = attribute.namedChildren;

    console.log(children);

    let index = 0;

    let attributeName = children[index];
    if (attributeName) {
      visitAttributeName(attributeName, state);
    }

    index++;
    let attributeValue = children[index];

    if (attributeValue) {
      pushRange(state, "=");
      traverseTree(attributeValue, state);
      return;
    } else {
      pushRange(state, "=");
      pushRangeSurround(
        state,
        attributeName.text,
        getRange(attributeName),
        "'",
      );
    }
  }
}

function pushRangeSurround(
  state: State,
  toPush: string,
  pugRange: Parser.Range,
  surround: string,
) {
  pushRange(state, surround);
  pushRange(state, toPush, pugRange);
  pushRange(state, surround);
}

function visitTagName(node: Parser.SyntaxNode, state: State) {
  pushRange(state, node.text, getRange(node));
}

function visitIdClass(nodes: Parser.SyntaxNode[], state: State) {
  let start = true;

  for (const node of nodes) {
    if (!start) {
      pushRange(state, " ");
    }

    let range = getRange(node);
    range.startIndex += 1;
    let text = node.text.substring(1);

    pushRange(state, text, range);

    start = false;
  }
}

function visitTag(node: Parser.SyntaxNode, state: State) {
  let childNodes = node.namedChildren;

  let index = 0;
  let nameNode = childNodes[index];

  let hasChildren = false;

  let classes: Parser.SyntaxNode[] = [];
  let ids: Parser.SyntaxNode[] = [];

  for (const childNode of childNodes) {
    if (childNode.type == "tag_name") {
      pushRange(state, "<");
      traverseTree(childNode, state);
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

      pushRange(state, " ");
      traverseTree(childNode, state);

      continue;
    }

    if (!hasChildren) {
      if (isVoidElement(nameNode.text)) {
        pushRange(state, "/");
      }
      pushRange(state, ">");
      hasChildren = true;
    }

    // found something else that needs no extra handling
    traverseTree(childNode, state);
  }

  if (!hasChildren) {
    if (isVoidElement(nameNode.text)) {
      pushRange(state, "/");
    }
    pushRange(state, ">");
  }

  if (!isVoidElement(nameNode.text)) {
    pushRange(state, "</");
    pushRange(state, nameNode.text);
    pushRange(state, ">");
  }

  // TODO: parse content for {{angular_interpolation}} using angular_content parser
}

function visitConditional(node: Parser.SyntaxNode, state: State) {
  let conditionalCursor = node.walk();

  conditionalCursor.gotoFirstChild();
  conditionalCursor.gotoNextSibling();

  if (conditionalCursor.currentNode.type == "javascript") {
    let condition = conditionalCursor.currentNode;

    pushRange(state, "<script>return ");
    pushRange(state, condition.text, getRange(condition));
    pushRange(state, ";</script>");
    conditionalCursor.gotoNextSibling();
  }

  conditionalCursor.gotoNextSibling();

  let children = conditionalCursor.currentNode.namedChildren;
  for (const child of children) {
    traverseTree(child, state);
  }
}

function visitPipe(node: Parser.SyntaxNode, state: State) {
  let cursor = node.walk();

  cursor.gotoFirstChild();
  while (cursor.gotoNextSibling()) {
    if (cursor.currentNode.isNamed) {
      traverseTree(cursor.currentNode, state);
    }
  }
}

function visitTagInterpolation(node: Parser.SyntaxNode, state: State) {
  let interpolationCursor = node.walk();

  interpolationCursor.gotoFirstChild();
  interpolationCursor.gotoNextSibling();
  let children = interpolationCursor.currentNode.namedChildren;

  for (const child of children) {
    traverseTree(child, state);
  }
}

function visitFilename(node: Parser.SyntaxNode, state: State) {
  pushRange(state, '<a href="');
  pushRange(state, node.text, getRange(node));
  pushRange(state, '">');
}

function visitExtendsInclude(node: Parser.SyntaxNode, state: State) {
  for (const child of node.namedChildren) {
    traverseTree(child, state);
  }
}

function visitCaseWhen(node: Parser.SyntaxNode, state: State) {
  let children = node.namedChildren;
  for (const child of children) {
    if (child.type == "javascript") {
      pushRange(state, "<script>return ");
      pushRange(state, child.text, getRange(child));
      pushRange(state, ";</script>");
    } else {
      traverseTree(child, state);
    }
  }
}

function visitUnbufferedCode(node: Parser.SyntaxNode, state: State) {
  for (const child of node.namedChildren) {
    if (child.type == "javascript") {
      pushRange(state, "<script>");
      pushRange(state, child.text, getRange(child));
      pushRange(state, ";</script>");
    } else {
      traverseTree(child, state);
    }
  }
}

function visitBufferedCode(node: Parser.SyntaxNode, state: State) {
  for (const child of node.namedChildren) {
    if (child.type == "javascript") {
      pushRange(state, "<script>return ");
      pushRange(state, child.text, getRange(child));
      pushRange(state, ";</script>");
    } else {
      traverseTree(child, state);
    }
  }
}

function traverseTree(node: Parser.SyntaxNode, state: State) {
  let nodeType = node.type;

  if (node.isNamed) {
    switch (nodeType) {
      case "source_file":
      case "children":
      case "mixin_definition":
      case "block_definition":
      case "block_use":
      case "each": {
        let children = node.namedChildren;
        for (const child of children) {
          traverseTree(child, state);
        }
        break;
      }
      case "iteration_variable":
      case "iteration_iterator": {
        for (const child of node.namedChildren) {
          if (child.type == "javascript") {
            pushRange(state, "<script>return ");
            pushRange(state, child.text, getRange(child));
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
            pushRange(state, child.text, getRange(child));
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
          pushRange(state, text, getRange(interpolationContent));
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
        pushRangeSurround(state, node.text, getRange(node), "'");
        break;
      }
      case "quoted_attribute_value": {
        pushRange(state, node.text, getRange(node));
        break;
      }
      case "content": {
        for (const interpolation of node.namedChildren) {
          traverseTree(interpolation, state);
        }
        // Always traverse the whole content after we've traversed the interpolation, so they
        // appear after in the conversion ranges
        pushRange(state, node.text, getRange(node));
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
          break;
        }
      }
      default: {
        console.log("Unhandled node type: {}", nodeType);
      }
    }
  }
}

demo();
