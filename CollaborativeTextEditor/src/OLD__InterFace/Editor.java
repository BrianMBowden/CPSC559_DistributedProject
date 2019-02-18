package OLD__InterFace;

import java.awt.Button;

import javafx.application.Application;
import javafx.scene.Cursor;
import javafx.scene.ImageCursor;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.image.Image;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.event.EventHandler;
import javafx.scene.web.HTMLEditor;
import javafx.scene.web.WebEngine;
import javafx.scene.web.WebView;
import javafx.stage.Stage;

public class Editor extends Application {
	public static void main(String[] args) {
		launch(args);
	}

	@Override
	public void start(Stage stage) throws Exception {
		HTMLEditor htmlEditor = new HTMLEditor();
		htmlEditor.setPrefHeight(360);
		htmlEditor.setPrefWidth(360);
		htmlEditor.addEventHandler(KeyEvent.ANY, new EventHandler<KeyEvent>() {
			@Override
			public void handle(KeyEvent event) {
				if (event.getCode().equals(KeyCode.UNDEFINED)) {
					System.out.println("Key Consumed: because its a UNDEFINED Key");
					event.consume();
				} else {
					new EditorController(event);
				}
			}
		});

		Scene scene = new Scene(htmlEditor);
		

		htmlEditor.addEventHandler(MouseEvent.ANY, new EventHandler<MouseEvent>() {
			@Override
			public void handle(MouseEvent event) {
				if (event.getButton().equals(MouseButton.NONE)) {
					System.out.println(" Mouse Key Consumed: because its a NONE button click");
					event.consume();
				} else {
					new EditorController(event);
				}
			}
		});

		
		// add cursor handler
		WebView webNode = (WebView) htmlEditor.lookup(".web-view");

		/*
		webNode.addEventHandler(MouseEvent.ANY, new EventHandler<MouseEvent>() {

			@Override
			public void handle(MouseEvent event) {
				System.out.println("Live mouse movement");
			}
		});
		*/
		
		stage.setTitle("TypeIt");
		stage.getIcons().add(new Image("InterFace/transparent-icon.png"));
		stage.setScene(scene);
		stage.show();

	}

}