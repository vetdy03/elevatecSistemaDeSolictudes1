import Swal from "sweetalert2";

/** En celular los diálogos salen como panel desde abajo; en escritorio, centrados. */
function layout() {
  const mobile = window.matchMedia("(max-width: 1023px)").matches;
  return {
    position: mobile ? ("bottom" as const) : ("center" as const),
    grow: mobile ? ("row" as const) : (false as const),
    width: mobile ? "100%" : "32rem",
    customClass: { popup: mobile ? "!rounded-b-none !m-0" : "", input: "!text-sm" }
  };
}

interface AskTextOptions {
  title: string;
  text?: string;
  placeholder: string;
  confirmText: string;
  confirmColor: string;
  minLength?: number;
}

/**
 * Pide un texto obligatorio. El botón de confirmar queda deshabilitado
 * hasta que haya al menos `minLength` caracteres (sin contar espacios).
 * Devuelve el texto, o null si se canceló.
 */
export async function askText({ title, text, placeholder, confirmText, confirmColor, minLength = 5 }: AskTextOptions): Promise<string | null> {
  const result = await Swal.fire({
    ...layout(),
    title,
    text,
    input: "textarea",
    inputPlaceholder: placeholder,
    inputAttributes: { maxlength: "1000", "aria-label": title },
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancelar",
    confirmButtonColor: confirmColor,
    reverseButtons: true,
    didOpen: () => {
      const input = Swal.getInput() as HTMLTextAreaElement | null;
      const confirm = Swal.getConfirmButton();
      if (!input || !confirm) return;
      const sync = () => { confirm.disabled = input.value.trim().length < minLength; };
      sync();
      input.addEventListener("input", sync);
    },
    inputValidator: (value) => (value.trim().length < minLength ? `Escribe al menos ${minLength} caracteres.` : undefined)
  });
  return result.isConfirmed ? String(result.value).trim() : null;
}

export interface InfoAnswer {
  answer: string;
  attachment: File | null;
}

/** Respuesta de Secretaría a un "Más info": texto obligatorio + adjunto opcional (PDF/JPG/PNG, 10 MB). */
export async function askAnswer(question: string): Promise<InfoAnswer | null> {
  const result = await Swal.fire<InfoAnswer>({
    ...layout(),
    title: "Responder al Administrador",
    html: `
      <div style="text-align:left">
        <p style="font-size:13px;color:#475569;margin:0 0 8px"><strong>Pregunta:</strong> ${escapeHtml(question)}</p>
        <textarea id="info-answer" class="swal2-textarea" style="margin:0;width:100%;font-size:14px" maxlength="2000" placeholder="Escribe tu respuesta…" aria-label="Respuesta"></textarea>
        <label style="display:block;margin-top:12px;font-size:12px;font-weight:600;color:#475569">Adjunto (opcional · PDF, JPG o PNG · máx. 10 MB)
          <input id="info-attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:block;margin-top:6px;font-size:12px" />
        </label>
      </div>`,
    showCancelButton: true,
    confirmButtonText: "Enviar respuesta",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#0f4c81",
    reverseButtons: true,
    focusConfirm: false,
    didOpen: () => {
      const input = document.getElementById("info-answer") as HTMLTextAreaElement;
      const confirm = Swal.getConfirmButton();
      const sync = () => { if (confirm) confirm.disabled = input.value.trim().length < 2; };
      sync();
      input.addEventListener("input", sync);
      input.focus();
    },
    preConfirm: () => {
      const answer = (document.getElementById("info-answer") as HTMLTextAreaElement).value.trim();
      const attachment = (document.getElementById("info-attachment") as HTMLInputElement).files?.[0] ?? null;
      if (answer.length < 2) {
        Swal.showValidationMessage("Escribe tu respuesta.");
        return false;
      }
      if (attachment && !/\.(pdf|jpe?g|png)$/i.test(attachment.name)) {
        Swal.showValidationMessage("El adjunto debe ser PDF, JPG o PNG.");
        return false;
      }
      if (attachment && attachment.size > 10 * 1024 * 1024) {
        Swal.showValidationMessage("El adjunto supera el máximo de 10 MB.");
        return false;
      }
      return { answer, attachment };
    }
  });
  return result.isConfirmed && result.value ? result.value : null;
}

/** Confirmación simple (Sí / Cancelar). */
export async function confirmAction(title: string, text: string, confirmText: string, confirmColor = "#0f4c81"): Promise<boolean> {
  const result = await Swal.fire({ icon: "question", title, text, showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: "Cancelar", confirmButtonColor: confirmColor, reverseButtons: true });
  return result.isConfirmed;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
