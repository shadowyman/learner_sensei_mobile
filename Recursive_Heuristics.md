LeetCode problems analyzed for this guideline: 104, 100, 226, 101, 112, 98, 230, 236, 113, 105, 572, 222, 199, 687, 863, 116, 124, 297, 333, 99, 437, 543, 662, 1372, 129, 51, 72, 312, 110, 450.

Here is the definitive, expanded guideline for designing the contract and base cases for any recursive function. This is your shark-proof cage.

### Step 2 (Expanded): Define the Function Contract (The Signature)

The function signature is the most critical piece of your design. It is a precise contract that defines the flow of information. Answer these questions in order to build it piece by piece.

**Question 2.1: What is the function's primary job?**

*   **(A) To COMPUTE a value or find a single thing (Computational):** The function's main purpose is to `return` a result to its caller. Proceed to Question 2.2.
*   **(B) To GENERATE a collection of all possible answers (Generative/Backtracking):** The function builds up results over time. Your contract will likely be `void` and will use reference parameters to manage state.
    *   **Signature Template:** `void solve(InputState, GlobalResults& results, CurrentPath& path)`
    *   *Example (Path Sum II):* `void findPaths(TreeNode* node, int sum, vector<vector<int>>& allPaths, vector<int>& currentPath)`

**Question 2.2: What information must this node RETURN UP to its parent? (Defines the `return` type)**

*   **A single, simple fact?** (e.g., a count, a max depth, a boolean validity check)
    *   **Return Type:** `int`, `bool`, `long long`, etc.
    *   *Example (Max Depth):* `int maxDepth(TreeNode* node)`
*   **A specific location or object?** (e.g., the Lowest Common Ancestor, a node to be deleted)
    *   **Return Type:** `TreeNode*` (or other pointer types)
    *   *Example (LCA):* `TreeNode* lowestCommonAncestor(TreeNode* root, ...)`
*   **Multiple, related facts?** (e.g., a subtree's sum AND its node count; a node's max zigzag path going left AND right)
    *   **Return Type:** `struct Result` or `pair<T1, T2>` or `vector<int>`
    *   *Example (Largest BST Subtree):* `Result largestBSTSubtree(TreeNode* node)` where `Result` is a struct containing `{min_val, max_val, node_count}`.

**Question 2.3: What information does this node need PASSED DOWN from its parent/ancestors? (Defines the `parameters`)**

*   **Constraints on the current node?** (e.g., the valid range for a BST node's value)
    *   **Parameters:** `long min_bound, long max_bound`
    *   *Example (Validate BST):* `bool isValid(TreeNode* node, long min, long max)`
*   **An accumulated value from the path above?** (e.g., the sum of values from the root to here)
    *   **Parameters:** `int current_sum`
    *   *Example (Sum Root to Leaf Numbers):* `int sumNumbers(TreeNode* node, int current_sum)`
*   **Structural context involving other nodes?** (e.g., checking if two separate subtrees are mirror images)
    *   **Parameters:** `TreeNode* node1, TreeNode* node2`
    *   *Example (Symmetric Tree):* `bool isMirror(TreeNode* t1, TreeNode* t2)`
*   **Indexing into external data structures?** (e.g., when building a tree from preorder and inorder arrays)
    *   **Parameters:** `int pre_start, int pre_end, int in_start, int in_end`
    *   *Example (Construct Tree):* `TreeNode* build(..., int in_start, int in_end)`

**Question 2.4: Is the value returned to the parent DIFFERENT from the final answer you're tracking? (The Dual Information Check)**

This is a common and crucial pattern. The function `returns` a value for the local recursive structure, but it updates a global answer via reference.

*   **Yes?** Add a **reference parameter** to track the global answer.
    *   **Signature Template:** `LocalReturnType solve(TreeNode* node, GlobalAnswerType& global_answer)`
    *   *Example (Diameter of Binary Tree):* `int height(TreeNode* node, int& diameter)`. The function *returns* the height of the current subtree (local info for the parent), but it *updates* the global `diameter` variable if a new max diameter is found at the current node.

### Step 3 (Expanded): Define the Base Cases (The Off-Ramps)

Base cases are the exit ramps from your recursion. A robust function checks them in a specific, hierarchical order to prevent errors and handle termination correctly.

**Step 3.1: The Structural Termination Case (Mandatory First Check)**

This case prevents your code from crashing by accessing null pointers or going out of bounds. It's always the first `if` statement.

*   **For Trees:** `if (node == nullptr) { ... }`
*   **For Array/String Indices:** `if (index >= n || index < 0) { ... }`
*   **For Index Ranges:** `if (start > end) { ... }`

*   **What to return?** The **Identity Value** for your combination logic. This is a value that, when combined with another result, doesn't change it.

| Combination Logic | Identity Value to Return |
| :--- | :--- |
| Summation (`+`) | `0` |
| Product (`*`) | `1` |
| Max (`max()`) | `INT_MIN` or `-infinity` |
| Min (`min()`) | `INT_MAX` or `+infinity` |
| Logical AND (`&&`) | `true` |
| Logical OR (`||`) | `false` |
| Pointer Search | `nullptr` |
| Node Construction | `nullptr` |

**Step 3.2: The Memoization Case (For Dynamic Programming)**

If the problem can be optimized with memoization, this is your second check. It prevents re-computing solutions for subproblems you've already solved.

*   **Check:** `if (memo[currentState] has been computed) { return memo[currentState]; }`
*   *Example (Edit Distance):* `if (dp[i][j] != -1) { return dp[i][j]; }`

**Step 3.3: The "Goal Achieved" or "Leaf Node" Case (Problem-Specific Success)**

This is where you check if the current node/state represents a successful end to a path. This is common in search and generative problems.

*   **For Leaf Nodes:** `if (node->left == nullptr && node->right == nullptr) { ... }`
    *   *Example (Path Sum):* Inside this block, you'd check `if (current_sum + node->val == target_sum) return true;`
*   **For Generative Problems:** This is where you add a completed path to your results.
    *   *Example (N-Queens):* `if (row == n) { results.push_back(board); return; }`

**Step 3.4: The Pruning Case (Problem-Specific Early Failure)**

This is an optional but powerful optimization for search/validation problems. If you can determine that the current path can *never* lead to a valid solution, you stop and return early.

*   **Check:** `if (current_state is invalid) { return failure_value; }`
*   *Example (Validate BST):* `if (node->val <= min_bound || node->val >= max_bound) { return false; }`
