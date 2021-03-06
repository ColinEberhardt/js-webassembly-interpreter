// @flow

// FIXME(sven): do the same with all block instructions, must be more generic here

const { traverse } = require("../../AST/traverse");
const t = require("../../AST");

export function transform(ast: Program) {
  const functionsInProgram: Array<Index> = [];

  // First collect the indices of all the functions in the Program
  traverse(ast, {
    ModuleImport({ node }: NodePath<ModuleImport>) {
      functionsInProgram.push(t.identifier(node.name));
    },

    Func({ node }: NodePath<Func>) {
      if (node.id == null) {
        return;
      }

      functionsInProgram.push(node.id);
    }
  });

  // Transform the actual instruction in function bodies
  traverse(ast, {
    Func(path: NodePath<Func>) {
      transformFuncPath(path, functionsInProgram);
    }
  });
}

function transformFuncPath(
  funcPath: NodePath<Func>,
  functionsInProgram: Array<Index>
) {
  const funcNode = funcPath.node;
  const { params } = funcNode;

  traverse(funcNode, {
    Instr(instrPath: NodePath<Instruction>) {
      const instrNode = instrPath.node;

      if (
        instrNode.id === "get_local" ||
        instrNode.id === "set_local" ||
        instrNode.id === "tee_local"
      ) {
        const [firstArg] = instrNode.args;

        if (firstArg.type === "Identifier") {
          const offsetInParams = params.findIndex(
            ({ id }) => id === firstArg.value
          );

          if (offsetInParams === -1) {
            throw new Error(
              `${firstArg.value} not found in ${
                instrNode.id
              }: not declared in func params`
            );
          }

          const indexNode = t.numberLiteral(offsetInParams);

          // Replace the Identifer node by our new NumberLiteral node
          instrNode.args[0] = indexNode;
        }
      }
    },

    CallInstruction({ node }: NodePath<CallInstruction>) {
      const index = node.index;

      if (index.type === "Identifier") {
        const offsetInFunctionsInProgram = functionsInProgram.findIndex(
          ({ value }) => value === index.value
        );

        if (offsetInFunctionsInProgram === -1) {
          throw new Error(
            `${
              index.value
            } not found in CallInstruction: not declared in Program`
          );
        }

        const indexNode = t.numberLiteral(offsetInFunctionsInProgram, "i32");

        // Replace the index Identifier
        node.index = indexNode;
      }
    }
  });
}
