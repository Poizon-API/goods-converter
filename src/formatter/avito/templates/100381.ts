import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100381 — «Слипоны и эспадрильи» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100381,
  nodeName: "Слипоны и эспадрильи",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Слипоны и эспадрильи"],
});
