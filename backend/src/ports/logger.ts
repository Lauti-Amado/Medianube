// Puerto compartido por todos los casos de uso.

export interface LoggerPort {
  info(mensaje: string): void;
  warn(mensaje: string): void;
  error(mensaje: string): void;
}
