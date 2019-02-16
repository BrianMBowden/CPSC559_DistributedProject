package InterFace;

import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.web.HTMLEditor;
import javafx.stage.Stage;

public class Editor extends Application {
	public static void main(String[] args) {
		launch(args);
	}

	@Override
	public void start(Stage stage) throws Exception {
		HTMLEditor htmlEditor = new HTMLEditor();
		Scene scene = new Scene(htmlEditor);
		stage.setScene(scene);
		stage.show();
		
	}

}
