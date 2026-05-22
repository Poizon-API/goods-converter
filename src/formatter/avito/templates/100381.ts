import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100381.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100381 — «Слипоны и эспадрильи» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100381,
  nodeName: "Слипоны и эспадрильи",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Слипоны и эспадрильи"],
  sizeValues: snapshot.externalValues.Size,
});
