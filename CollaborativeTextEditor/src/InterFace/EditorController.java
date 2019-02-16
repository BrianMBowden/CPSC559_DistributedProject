package InterFace;

import javafx.fxml.FXML;
import javafx.scene.control.TextArea;

public class EditorController {

	@FXML
	private TextArea txtArea;

	private EditorModel edModel;

	public EditorController(EditorModel model) {
		this.edModel = model;
	}
	
	@FXML
	private void onOpen() {

	}

	@FXML
	private void onSave() {

	}

	@FXML
	private void onClose() {
		System.exit(0);
	}
}
