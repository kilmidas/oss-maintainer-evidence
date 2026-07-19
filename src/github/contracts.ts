export type PaginationMode = "none" | "page";
export type AbsenceBehavior = "404" | "204" | "none";
export type ActivityClass = "required" | "optional";
export interface EndpointContract<K extends string = string> {
  readonly key: K;
  readonly template: string;
  readonly pagination: PaginationMode;
  readonly absence: AbsenceBehavior;
  readonly activity: ActivityClass;
  readonly queryKeys: readonly string[];
}
export interface BuiltEndpoint {
  readonly path: string;
  readonly contract: EndpointContract;
  readonly __brand: "BuiltEndpoint";
}
