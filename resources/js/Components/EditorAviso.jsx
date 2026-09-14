import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Fora do componente: o Quill reinicia o editor se `modules` mudar de identidade.
const MODULOS = {
    toolbar: [['bold', 'italic', 'underline', 'strike'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']],
};

/**
 * Editor de texto do Mural de Avisos.
 *
 * Arquivo próprio para ser carregado sob demanda (React.lazy em NoticeBoard):
 * só admin e gestor escrevem aviso, e o Quill pesava no Dashboard de todos.
 */
export default function EditorAviso({ value, onChange }) {
    return (
        <ReactQuill
            theme="snow"
            value={value}
            onChange={onChange}
            placeholder="Conteúdo da mensagem..."
            className="h-32"
            modules={MODULOS}
        />
    );
}
