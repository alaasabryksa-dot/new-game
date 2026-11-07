import { createFileRoute } from "@tanstack/react-router";
import { DarSalam } from "@/components/dar-salam";

export const Route = createFileRoute("/")({ component: DarSalam });
