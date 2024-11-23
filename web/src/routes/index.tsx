import { createFileRoute } from "@tanstack/react-router";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

interface PromptResponse {
	hatchId: string;
}

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const [promptText, setPromptText] = useState("");
	const navigate = useNavigate();

	const submitPromptMutation = useMutation({
		mutationFn: async (prompt: string) => {
			const response = await fetch("/api/prompt", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ prompt }),
			});

			if (!response.ok) {
				throw new Error("Failed to submit prompt");
			}

			return response.json() as Promise<PromptResponse>;
		},
		onSuccess: (data) => {
			navigate({ to: "/hatch/$hatchId", params: { hatchId: data.hatchId } });
		},
	});

	function handleSubmitPrompt(event: React.FormEvent) {
		event.preventDefault();
		if (!promptText.trim()) return;

		submitPromptMutation.mutate(promptText);
	}

	return (
		<main className="flex justify-center items-center h-screen">
			<form
				onSubmit={handleSubmitPrompt}
				className="w-full grid gap-4 rounded-md border border-gray-600 p-4 max-w-4xl"
			>
				<Textarea
					placeholder="Write a hatch prompt"
					className="w-full font-mono border-0 bg-transparent text-white resize-none"
					value={promptText}
					onChange={(e) => setPromptText(e.target.value)}
					disabled={submitPromptMutation.isPending}
				/>
				<div className="flex justify-end">
					<Button
						variant="default"
						className="text-white font-mono"
						type="submit"
						disabled={submitPromptMutation.isPending}
					>
						{submitPromptMutation.isPending ? "Hatching..." : "Hatch"}
					</Button>
				</div>
			</form>
		</main>
	);
}
