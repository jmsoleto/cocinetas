/* Lo que la aplicación necesita del entorno.
 *
 * `worker-configuration.d.ts` lo genera `wrangler types` deduciendo los nombres
 * de los secrets a partir de `.dev.vars`, que está fuera del control de
 * versiones — y con razón. La consecuencia es que en un clon limpio ese fichero
 * sale sin estas dos propiedades y `npm run typecheck` falla antes de que nadie
 * haya hecho nada mal.
 *
 * Declararlas aquí convierte el entorno en una contrata explícita y versionada:
 * los tipos dejan de depender de qué tenga cada quien en su máquina, y este
 * fichero sirve además de lista de lo que hay que cargar como secret al
 * desplegar. */
declare global {
  interface Env {
    /** URL de la API de Supabase. En local, `supabase status` → API_URL. */
    SUPABASE_URL: string;
    /** Clave pública de Supabase. En local, `supabase status` → ANON_KEY. */
    SUPABASE_ANON_KEY: string;
  }
}

export {};
