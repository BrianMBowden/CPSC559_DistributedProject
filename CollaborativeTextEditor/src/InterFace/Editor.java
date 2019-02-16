package InterFace;

import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.stage.Stage;

public class Editor extends Application{
	public static void main(String[] args) {
		launch(args);		
	}
	
	@Override
	public void start(Stage stage) throws Exception {
		
		FXMLLoader uiLoader = new FXMLLoader(getClass().getResource("UI.fxml"));
		uiLoader.setControllerFactory(newController -> new EditorController(new EditorModel()));
		
		Scene scene = new Scene(uiLoader.load());
		stage.setScene(scene);
		stage.show();
	}

}
