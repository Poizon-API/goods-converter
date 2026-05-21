import { type AvitoCategorySchema } from "../shared";
import { type SupportedTemplateId } from "../types";
import { SCHEMA as SCHEMA_100368 } from "./100368";
import { SCHEMA as SCHEMA_100370 } from "./100370";
import { SCHEMA as SCHEMA_100372 } from "./100372";
import { SCHEMA as SCHEMA_100378 } from "./100378";
import { SCHEMA as SCHEMA_100384 } from "./100384";
import { SCHEMA as SCHEMA_100388 } from "./100388";
import { SCHEMA as SCHEMA_100389 } from "./100389";
import { SCHEMA as SCHEMA_100392 } from "./100392";

/**
 * Реестр всех поддерживаемых Avito autoload-template'ов. Используется
 * `AvitoFormatter` для lookup'а схемы по `options.templateId`.
 *
 * При добавлении нового template'а:
 *   1. Положи `<id>.ts` рядом с этим файлом.
 *   2. Добавь сюда.
 *   3. Расширь `SupportedTemplateId` в `../types.ts`.
 */
export const TEMPLATE_REGISTRY: Record<
  SupportedTemplateId,
  AvitoCategorySchema
> = {
  100368: SCHEMA_100368,
  100370: SCHEMA_100370,
  100372: SCHEMA_100372,
  100378: SCHEMA_100378,
  100384: SCHEMA_100384,
  100388: SCHEMA_100388,
  100389: SCHEMA_100389,
  100392: SCHEMA_100392,
};
