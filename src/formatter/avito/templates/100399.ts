import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100399 — «Слипоны и эспадрильи» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100399,
  nodeName: "Слипоны и эспадрильи",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Слипоны и эспадрильи"],
});
