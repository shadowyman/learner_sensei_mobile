# Text Format Standardization Task

## Objective
Transform a structured educational text file (`Modules.txt`) into a standardized format that can be parsed deterministically across different platforms and regex engines.

## Background
The current file contains educational modules with hierarchical content but uses inconsistent formatting that causes parsing issues:
- Unicode bullet characters (•, ◦, ▪)
- Mixed indentation patterns
- Inconsistent structure between sections

## Input File Structure
The file contains multiple modules, each with this general structure:
```
Module [number]: [title]
Goal: [content]
Concepts:
    [hierarchical content with various bullet types]
Methodology:
    [hierarchical content]
Socratic:
    [hierarchical content]
Solidify & Prepare:
    [content]
```

## Required Transformation Rules

### 1. Character Replacements
Replace ALL Unicode/special characters with ASCII equivalents:
- `•` → `-` (dash with space after)
- `◦` → Convert to lettered sub-points (a., b., c.)
- `▪` → `-` (dash) OR roman numerals (i., ii., iii.) for deeply nested items
- Any other bullet types → `-`

### 2. Hierarchical Structure Rules
Use ONLY tabs for indentation (no spaces for hierarchy):
- Level 0: Module headers, section headers (Goal:, Concepts:, etc.)
- Level 1: `[TAB]1. Item title:`
- Level 2: `[TAB][TAB]a. Sub-item title:`
- Level 3: `[TAB][TAB][TAB]- List item` OR `[TAB][TAB][TAB]i. Numbered sub-item`
- Level 4: `[TAB][TAB][TAB][TAB]-- Deeper item`

### 3. Content Formatting Rules
1. **Section Headers** (Module, Goal, Concepts, Methodology, Socratic, Solidify & Prepare):
   - Must start at column 0 (no indentation)
   - Must end with colon (:)
   - Module line: title on same line after colon
   - All others: content starts on next line

2. **Numbered Items**:
   - Format: `[TABS]N. Title:`
   - Content MUST start on the next line with one additional tab
   - Use regular numbers (1., 2., 3.) for main items
   - Use letters (a., b., c.) for sub-items
   - Use roman numerals (i., ii., iii.) for third-level items

3. **List Items**:
   - Use `-` for bullet points at any level
   - Use `--` for deeper nested bullets
   - Always include space after dash

4. **Content Rules**:
   - Each paragraph on its own line at the same indentation level
   - Empty line between paragraphs at the same level
   - Quoted text remains quoted but follows indentation rules
   - No trailing whitespace on any line

### 4. Special Cases

#### Socratic Section LeetCode Problems:
```
[TAB]2. LeetCode Practice Problems:
[TAB][TAB]a. LC 700: Search in a Binary Search Tree (Easy)
[TAB][TAB][TAB]- AI Guidance: [content]
[TAB][TAB][TAB]- Problem-Specific Questions:
[TAB][TAB][TAB][TAB]"Question 1"
[TAB][TAB][TAB][TAB]"Question 2"
```

#### Multi-line Content:
When content has multiple points on the same line separated by periods or commas, keep them together unless they're clearly separate concepts.

### 5. Example Transformation

**Before:**
```
Concepts:
	1.	The Function Contract: Defining the Promise
	◦	Principle: Text here
	▪	Point one
	▪	Point two
```

**After:**
```
Concepts:
	1. The Function Contract: Defining the Promise
		a. Principle:
			Text here
			- Point one
			- Point two
```

## Validation Requirements
The output must:
1. Use ONLY ASCII characters
2. Use ONLY tabs for indentation (no spaces for hierarchy)
3. Have consistent structure throughout
4. Maintain all original content (no content deletion)
5. Be parseable by standard regex patterns

## Reference Example
A complete standardized version of Module 3 is available in `preview/Module3_Standardized.txt` as a reference. This shows exactly how the transformation should be applied to a full module, including:
- How to handle complex Socratic sections with LeetCode problems
- Proper indentation for multi-level hierarchies
- Conversion of all bullet types
- Formatting of quoted questions and guidance

## Deliverable
Transform the entire `Modules.txt` file according to these rules, maintaining all content while standardizing the format. The output should be a new file that can be parsed deterministically on any platform.

## Important Notes
- Preserve ALL content - only change formatting
- When in doubt about hierarchy, maintain the original's intended structure
- Test that tabs are used consistently (no mixing with spaces)
- Ensure no Unicode characters remain in the output
- Use `preview/Module3_Standardized.txt` as your reference for how the final format should look