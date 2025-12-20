import { tool } from "@opencode-ai/plugin";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { truncateOutput, formatError } from "../lib/tool-utils";

/**
 * UI Prop Validator
 *
 * Validates shadcn/ui component usage to prevent prop hallucination.
 * This is a "Hard Tool" - deterministic validation against known component APIs.
 */

/**
 * Known shadcn/ui components and their valid props
 * This is a subset - for comprehensive validation, use the shadcn MCP server
 */
const SHADCN_COMPONENTS: Record<
  string,
  {
    validProps: string[];
    variants?: string[];
    sizes?: string[];
    subComponents?: string[];
  }
> = {
  Button: {
    validProps: [
      "variant",
      "size",
      "asChild",
      "disabled",
      "className",
      "children",
      "onClick",
      "type",
    ],
    variants: [
      "default",
      "destructive",
      "outline",
      "secondary",
      "ghost",
      "link",
    ],
    sizes: ["default", "sm", "lg", "icon"],
  },
  Card: {
    validProps: ["className", "children"],
    subComponents: [
      "CardHeader",
      "CardTitle",
      "CardDescription",
      "CardContent",
      "CardFooter",
    ],
  },
  Input: {
    validProps: [
      "type",
      "placeholder",
      "disabled",
      "className",
      "value",
      "onChange",
      "name",
      "id",
    ],
  },
  Dialog: {
    validProps: ["open", "onOpenChange", "modal", "defaultOpen"],
    subComponents: [
      "DialogTrigger",
      "DialogContent",
      "DialogHeader",
      "DialogTitle",
      "DialogDescription",
      "DialogFooter",
      "DialogClose",
    ],
  },
  Select: {
    validProps: [
      "value",
      "onValueChange",
      "defaultValue",
      "open",
      "onOpenChange",
      "disabled",
      "name",
    ],
    subComponents: [
      "SelectTrigger",
      "SelectValue",
      "SelectContent",
      "SelectItem",
      "SelectGroup",
      "SelectLabel",
    ],
  },
  Table: {
    validProps: ["className", "children"],
    subComponents: [
      "TableHeader",
      "TableBody",
      "TableFooter",
      "TableHead",
      "TableRow",
      "TableCell",
      "TableCaption",
    ],
  },
  Form: {
    validProps: ["className", "children", "onSubmit"],
    subComponents: [
      "FormField",
      "FormItem",
      "FormLabel",
      "FormControl",
      "FormDescription",
      "FormMessage",
    ],
  },
  Badge: {
    validProps: ["variant", "className", "children"],
    variants: ["default", "secondary", "destructive", "outline"],
  },
  Alert: {
    validProps: ["variant", "className", "children"],
    variants: ["default", "destructive"],
    subComponents: ["AlertTitle", "AlertDescription"],
  },
  Avatar: {
    validProps: ["className", "children"],
    subComponents: ["AvatarImage", "AvatarFallback"],
  },
  Accordion: {
    validProps: [
      "type",
      "collapsible",
      "defaultValue",
      "value",
      "onValueChange",
      "className",
    ],
    subComponents: ["AccordionItem", "AccordionTrigger", "AccordionContent"],
  },
  Tabs: {
    validProps: ["defaultValue", "value", "onValueChange", "className"],
    subComponents: ["TabsList", "TabsTrigger", "TabsContent"],
  },
  Tooltip: {
    validProps: [
      "delayDuration",
      "skipDelayDuration",
      "disableHoverableContent",
    ],
    subComponents: ["TooltipTrigger", "TooltipContent", "TooltipProvider"],
  },
  Popover: {
    validProps: ["open", "onOpenChange", "modal"],
    subComponents: ["PopoverTrigger", "PopoverContent", "PopoverAnchor"],
  },
  DropdownMenu: {
    validProps: ["open", "onOpenChange", "modal"],
    subComponents: [
      "DropdownMenuTrigger",
      "DropdownMenuContent",
      "DropdownMenuItem",
      "DropdownMenuCheckboxItem",
      "DropdownMenuRadioItem",
      "DropdownMenuLabel",
      "DropdownMenuSeparator",
      "DropdownMenuShortcut",
      "DropdownMenuGroup",
      "DropdownMenuPortal",
      "DropdownMenuSub",
      "DropdownMenuSubContent",
      "DropdownMenuSubTrigger",
      "DropdownMenuRadioGroup",
    ],
  },
  Sheet: {
    validProps: ["open", "onOpenChange", "modal"],
    subComponents: [
      "SheetTrigger",
      "SheetContent",
      "SheetHeader",
      "SheetTitle",
      "SheetDescription",
      "SheetFooter",
      "SheetClose",
    ],
  },
  Checkbox: {
    validProps: [
      "checked",
      "onCheckedChange",
      "disabled",
      "required",
      "name",
      "value",
      "id",
      "className",
    ],
  },
  RadioGroup: {
    validProps: [
      "value",
      "onValueChange",
      "defaultValue",
      "disabled",
      "required",
      "name",
      "className",
    ],
    subComponents: ["RadioGroupItem"],
  },
  Switch: {
    validProps: [
      "checked",
      "onCheckedChange",
      "disabled",
      "required",
      "name",
      "value",
      "id",
      "className",
    ],
  },
  Slider: {
    validProps: [
      "value",
      "onValueChange",
      "defaultValue",
      "min",
      "max",
      "step",
      "disabled",
      "className",
    ],
  },
  Textarea: {
    validProps: [
      "placeholder",
      "disabled",
      "className",
      "value",
      "onChange",
      "name",
      "id",
      "rows",
    ],
  },
  Label: {
    validProps: ["htmlFor", "className", "children"],
  },
  Separator: {
    validProps: ["orientation", "decorative", "className"],
  },
  ScrollArea: {
    validProps: ["className", "children", "type"],
    subComponents: ["ScrollBar"],
  },
  Skeleton: {
    validProps: ["className"],
  },
  Progress: {
    validProps: ["value", "max", "className"],
  },
};

/**
 * Common hallucinated props that don't exist in shadcn/ui
 */
interface HallucinatedProp {
  prop: string;
  component: string; // "*" means any component
  note: string;
}

const HALLUCINATED_PROPS: HallucinatedProp[] = [
  {
    prop: "color",
    component: "Button",
    note: 'Use variant instead (e.g., variant="destructive")',
  },
  { prop: "primary", component: "*", note: 'Use variant="default"' },
  { prop: "secondary", component: "*", note: 'Use variant="secondary"' },
  { prop: "error", component: "*", note: 'Use variant="destructive"' },
  {
    prop: "success",
    component: "*",
    note: "Not a standard variant - use custom className",
  },
  {
    prop: "loading",
    component: "Button",
    note: "Implement with disabled + spinner child",
  },
  { prop: "icon", component: "Button", note: "Pass icon as children" },
  {
    prop: "leftIcon",
    component: "*",
    note: "Pass icon as children before text",
  },
  {
    prop: "rightIcon",
    component: "*",
    note: "Pass icon as children after text",
  },
  { prop: "fullWidth", component: "*", note: 'Use className="w-full"' },
  {
    prop: "rounded",
    component: "*",
    note: "Use className with rounded-* utilities",
  },
  { prop: "block", component: "*", note: 'Use className="w-full"' },
  { prop: "outline", component: "Button", note: 'Use variant="outline"' },
  { prop: "ghost", component: "Button", note: 'Use variant="ghost"' },
  { prop: "link", component: "Button", note: 'Use variant="link"' },
  { prop: "small", component: "*", note: 'Use size="sm"' },
  { prop: "large", component: "*", note: 'Use size="lg"' },
  {
    prop: "xs",
    component: "*",
    note: "Not a standard size - use custom className",
  },
  {
    prop: "xl",
    component: "*",
    note: "Not a standard size - use custom className",
  },
  { prop: "isOpen", component: "*", note: "Use open instead" },
  { prop: "onClose", component: "*", note: "Use onOpenChange instead" },
  { prop: "isDisabled", component: "*", note: "Use disabled instead" },
  {
    prop: "isLoading",
    component: "*",
    note: "Not a standard prop - implement manually",
  },
];

/**
 * Validation issue
 */
interface UIValidationIssue {
  file: string;
  line: number;
  component: string;
  prop: string;
  severity: "error" | "warning";
  message: string;
  fix: string;
}

/**
 * Extracted JSX component usage
 */
interface ExtractedComponent {
  name: string;
  props: string[];
  position: number;
}

/**
 * File extensions to scan
 */
const SCAN_EXTENSIONS = [".tsx", ".jsx"];

/**
 * Directories to skip
 */
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".next"];

/**
 * Extract JSX components from a line of code
 */
function extractJsxComponents(content: string): ExtractedComponent[] {
  const components: ExtractedComponent[] = [];

  // Match JSX component usage: <ComponentName prop="value" />
  const jsxRegex = /<([A-Z][a-zA-Z]*)\s*([^>]*?)(?:\/>|>)/g;
  let match;

  while ((match = jsxRegex.exec(content)) !== null) {
    const componentName = match[1];
    const propsString = match[2];

    // Extract props
    const props: string[] = [];
    const propRegex = /(\w+)(?:=(?:\{[^}]*\}|"[^"]*"|'[^']*'))?/g;
    let propMatch;

    while ((propMatch = propRegex.exec(propsString)) !== null) {
      props.push(propMatch[1]);
    }

    components.push({
      name: componentName,
      props,
      position: match.index,
    });
  }

  return components;
}

/**
 * Validate a component's props
 */
function validateComponent(
  component: ExtractedComponent,
  lineNumber: number,
  filePath: string,
): UIValidationIssue[] {
  const issues: UIValidationIssue[] = [];
  const componentDef = SHADCN_COMPONENTS[component.name];

  // Check if it's a known shadcn component
  if (!componentDef) {
    // Not a shadcn component - skip validation
    return issues;
  }

  // Check each prop
  component.props.forEach((prop) => {
    // Skip common React props
    if (
      [
        "key",
        "ref",
        "className",
        "style",
        "children",
        "id",
        "data-testid",
      ].includes(prop)
    ) {
      return;
    }

    // Check for hallucinated props
    const hallucinated = HALLUCINATED_PROPS.find(
      (h) =>
        h.prop === prop &&
        (h.component === "*" || h.component === component.name),
    );

    if (hallucinated) {
      issues.push({
        file: filePath,
        line: lineNumber,
        component: component.name,
        prop,
        severity: "error",
        message: `Hallucinated prop "${prop}" on ${component.name}`,
        fix: hallucinated.note,
      });
      return;
    }

    // Check if prop is valid for this component
    if (!componentDef.validProps.includes(prop)) {
      // Check if it's an event handler (onClick, onSubmit, etc)
      if (prop.startsWith("on") && prop[2] === prop[2].toUpperCase()) {
        return; // Event handlers are generally OK
      }

      // Check if it's an aria or data attribute
      if (prop.startsWith("aria-") || prop.startsWith("data-")) {
        return; // Accessibility and data attributes are OK
      }

      issues.push({
        file: filePath,
        line: lineNumber,
        component: component.name,
        prop,
        severity: "warning",
        message: `Unknown prop "${prop}" on ${component.name}`,
        fix: `Valid props: ${componentDef.validProps.join(", ")}`,
      });
    }
  });

  return issues;
}

/**
 * Recursively walk a directory
 */
async function walkDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.includes(entry.name) && !entry.name.startsWith(".")) {
          files.push(...(await walkDirectory(fullPath)));
        }
      } else if (
        entry.isFile() &&
        SCAN_EXTENSIONS.includes(extname(entry.name))
      ) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }

  return files;
}

/**
 * Scan a file for UI validation issues
 */
async function scanFile(filePath: string): Promise<UIValidationIssue[]> {
  const issues: UIValidationIssue[] = [];

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const components = extractJsxComponents(line);
      components.forEach((component) => {
        issues.push(...validateComponent(component, index + 1, filePath));
      });
    });
  } catch {
    // File not readable
  }

  return issues;
}

/**
 * Format validation issues for output
 */
function formatUIValidationIssues(issues: UIValidationIssue[]): string {
  if (issues.length === 0) {
    return "No shadcn/ui prop issues detected";
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const lines: string[] = [];

  lines.push("# shadcn/ui Prop Validation Results\n");
  lines.push(`Total: ${issues.length} issues found`);
  lines.push(`  Errors: ${errors.length}`);
  lines.push(`  Warnings: ${warnings.length}`);
  lines.push("");

  // Group by file
  const byFile = new Map<string, UIValidationIssue[]>();
  for (const issue of issues) {
    const existing = byFile.get(issue.file) || [];
    existing.push(issue);
    byFile.set(issue.file, existing);
  }

  for (const [file, fileIssues] of byFile) {
    lines.push(`## ${file}\n`);

    for (const issue of fileIssues) {
      const icon = issue.severity === "error" ? "" : "";
      lines.push(`${icon} Line ${issue.line}: ${issue.message}`);
      lines.push(`   Fix: ${issue.fix}`);
      lines.push("");
    }
  }

  lines.push(
    "\nNote: For comprehensive validation, use the shadcn MCP server to query real component APIs.",
  );

  return lines.join("\n");
}

/**
 * Validate shadcn/ui component usage
 */
export const validate_ui = tool({
  description:
    "Validate shadcn/ui component usage to prevent prop hallucination. Catches common mistakes like using 'color' instead of 'variant', 'loading' instead of disabled+spinner, etc.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to scan (default: src)"),
    json: tool.schema
      .boolean()
      .optional()
      .describe("Output as JSON instead of formatted text"),
  },
  async execute({ path: targetPath, json }) {
    try {
      const scanPath = targetPath || "src";

      // Check if path exists
      try {
        await stat(scanPath);
      } catch {
        return `Error: Path not found: ${scanPath}`;
      }

      // Collect files
      const files = await walkDirectory(scanPath);

      if (files.length === 0) {
        return `No TSX/JSX files found in ${scanPath}`;
      }

      // Scan all files
      const allIssues: UIValidationIssue[] = [];
      for (const file of files) {
        const issues = await scanFile(file);
        allIssues.push(...issues);
      }

      // Output
      if (json) {
        const result = {
          scanned: scanPath,
          filesScanned: files.length,
          timestamp: new Date().toISOString(),
          total: allIssues.length,
          errors: allIssues.filter((i) => i.severity === "error").length,
          warnings: allIssues.filter((i) => i.severity === "warning").length,
          issues: allIssues,
          note: "For comprehensive validation, use the shadcn MCP server",
        };
        return truncateOutput(JSON.stringify(result, null, 2));
      }

      return truncateOutput(formatUIValidationIssues(allIssues));
    } catch (e) {
      return formatError(e);
    }
  },
});

/**
 * Quick UI check - errors only
 */
export const check_ui = tool({
  description:
    "Quick shadcn/ui check - reports only hallucinated props (errors). Use before committing.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Path to check (default: src)"),
  },
  async execute({ path: targetPath }) {
    try {
      const scanPath = targetPath || "src";

      try {
        await stat(scanPath);
      } catch {
        return `Error: Path not found: ${scanPath}`;
      }

      const files = await walkDirectory(scanPath);

      if (files.length === 0) {
        return `No TSX/JSX files found in ${scanPath}`;
      }

      const allIssues: UIValidationIssue[] = [];
      for (const file of files) {
        const issues = await scanFile(file);
        allIssues.push(...issues);
      }

      const errors = allIssues.filter((i) => i.severity === "error");

      if (errors.length === 0) {
        return `shadcn/ui check passed (${files.length} files scanned)`;
      }

      const lines: string[] = [];
      lines.push(`${errors.length} hallucinated props found:\n`);

      for (const issue of errors) {
        lines.push(`  ${issue.file}:${issue.line}`);
        lines.push(`    ${issue.component}.${issue.prop} - ${issue.fix}\n`);
      }

      return truncateOutput(lines.join("\n"));
    } catch (e) {
      return formatError(e);
    }
  },
});

/**
 * List known shadcn/ui components
 */
export const list_shadcn_components = tool({
  description:
    "List all known shadcn/ui components with their valid props. Useful for quick reference.",
  args: {
    component: tool.schema
      .string()
      .optional()
      .describe("Specific component to show details for"),
  },
  async execute({ component }) {
    if (component) {
      const def = SHADCN_COMPONENTS[component];
      if (!def) {
        return `Component "${component}" not found. Available: ${Object.keys(SHADCN_COMPONENTS).join(", ")}`;
      }

      const lines: string[] = [];
      lines.push(`# ${component}\n`);
      lines.push(`## Valid Props\n${def.validProps.join(", ")}\n`);

      if (def.variants) {
        lines.push(`## Variants\n${def.variants.join(", ")}\n`);
      }
      if (def.sizes) {
        lines.push(`## Sizes\n${def.sizes.join(", ")}\n`);
      }
      if (def.subComponents) {
        lines.push(`## Sub-components\n${def.subComponents.join(", ")}\n`);
      }

      return lines.join("\n");
    }

    // List all components
    const lines: string[] = [];
    lines.push("# Known shadcn/ui Components\n");

    for (const [name, def] of Object.entries(SHADCN_COMPONENTS)) {
      const extras: string[] = [];
      if (def.variants) extras.push(`variants: ${def.variants.length}`);
      if (def.sizes) extras.push(`sizes: ${def.sizes.length}`);
      if (def.subComponents)
        extras.push(`sub-components: ${def.subComponents.length}`);

      lines.push(
        `- **${name}**: ${def.validProps.length} props${extras.length ? ` (${extras.join(", ")})` : ""}`,
      );
    }

    lines.push(
      "\nUse `list_shadcn_components component=Button` for details on a specific component.",
    );
    lines.push(
      "For comprehensive component info, use the shadcn MCP server: `shadcn.get_component('Button')`",
    );

    return lines.join("\n");
  },
});
