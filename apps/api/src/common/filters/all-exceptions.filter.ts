import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  requestId?: string;
}

/**
 * Глобальный exception-фильтр.
 *
 * Принципы (см. CLAUDE.md §4b):
 *  - Никогда не отдавать клиенту внутренние стектрейсы.
 *  - 5xx-ответ — обобщённое сообщение «Internal Server Error».
 *  - Полный лог — на сервере (pino), включая requestId, чтобы потом найти.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = request.id;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const body: ErrorResponseBody = {
        statusCode: status,
        error: HttpStatus[status] ?? 'Error',
        message:
          typeof res === 'string'
            ? res
            : (((res as { message?: string | string[] }).message as string) ?? exception.message),
        requestId,
      };
      response.status(status).json(body);
      return;
    }

    // Неожиданное исключение — логируем полностью на сервере, отдаём общий ответ.
    this.log.error(
      {
        err: serializeError(exception),
        requestId,
        method: request.method,
        path: request.url,
      },
      'Unhandled exception',
    );

    response.status(status).json({
      statusCode: status,
      error: 'Internal Server Error',
      message: 'Internal Server Error',
      requestId,
    });
  }
}

function serializeError(err: unknown): { message: string; stack?: string; name?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}
