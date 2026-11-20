import {
	createContext,
	type ReactNode,
	type Ref,
	type RefObject,
	useContext,
	useEffect,
	useState,
} from "react";

const key = "omashare.guestName";

export function normalizeGuestName(value: string) {
	const name = value.trim();
	return name && [...name].length <= 80 ? name : "";
}

const GuestCommentNameContext = createContext<{
	name: string;
	remember: (name: string) => void;
} | null>(null);

export function GuestCommentNameProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [name, setName] = useState("");
	useEffect(() => {
		try {
			setName(normalizeGuestName(window.localStorage.getItem(key) ?? ""));
		} catch {}
	}, []);
	const remember = (next: string) => {
		setName(next);
		try {
			if (next) window.localStorage.setItem(key, next);
			else window.localStorage.removeItem(key);
		} catch {}
	};
	return (
		<GuestCommentNameContext.Provider value={{ name, remember }}>
			{children}
		</GuestCommentNameContext.Provider>
	);
}

export function useGuestCommentName() {
	const state = useContext(GuestCommentNameContext);
	if (!state) throw new Error("Missing guest comment name provider");
	return state;
}

export function GuestCommentNameFields({
	fieldsRef,
}: {
	fieldsRef: Ref<HTMLDivElement>;
}) {
	const { name, remember } = useGuestCommentName();
	const [draft, setDraft] = useState("");
	return (
		<div ref={fieldsRef} className="space-y-2">
			{name ? (
				<div className="flex flex-wrap items-center gap-1 text-sm text-gray-11">
					<span>Commenting as {name} ·</span>
					<button
						type="button"
						className="text-gray-10 underline"
						onClick={() => {
							setDraft(name);
							remember("");
						}}
					>
						Change
					</button>
				</div>
			) : (
				<label className="flex flex-wrap items-center gap-2 text-sm text-gray-11">
					Your name
					<input
						autoComplete="name"
						name="guestName"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						className="min-w-0 rounded-lg border border-gray-5 bg-white px-2 py-1 text-gray-12"
					/>
				</label>
			)}
			<input
				hidden
				type="text"
				name="website"
				aria-label="Website"
				tabIndex={-1}
				autoComplete="off"
			/>
		</div>
	);
}

export function readGuestCommentFields(
	fields: RefObject<HTMLDivElement | null>,
	savedName: string,
) {
	const name = fields.current?.querySelector<HTMLInputElement>(
		'input[name="guestName"]',
	);
	return {
		guestName: savedName || name?.value || "",
		website:
			fields.current?.querySelector<HTMLInputElement>('input[name="website"]')
				?.value ?? "",
	};
}
