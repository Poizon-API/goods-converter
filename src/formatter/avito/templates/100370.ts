import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100370.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100370 — «Туфли» (мужская обувь).
 *
 * Per-template поля задаются здесь; остальные enum'ы и текстовые лимиты —
 * общие, см. `./sneakersCommon`. Sync с snapshot'ом — `test/avitoSchemaSync.spec.ts`.
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100370,
  nodeName: "Туфли",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Туфли"],
  sizeValues: snapshot.externalValues.Size,
});
