import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100368.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100368 — «Кроссовки» (мужская обувь).
 *
 * Per-template поля (templateId, nodeName, goodsTypeValues, apparelTypeValues)
 * задаются здесь; остальные enum'ы и текстовые лимиты — общие для всех
 * sneakers-template'ов, см. `./sneakersCommon`. Sync с snapshot'ом проверяет
 * `test/avitoSchemaSync.spec.ts`.
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100368,
  nodeName: "Кроссовки",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Кроссовки"],
  sizeValues: snapshot.externalValues.Size,
});
