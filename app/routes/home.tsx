import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Cocinetas" }];
}

export default function Home() {
  return <h1>Cocinetas</h1>;
}
