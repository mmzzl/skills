package main

import (
	"context"
	"fmt"
	"log"
	"time"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/bson"
)

type Stock struct {
	Code string `bson:"code"`
	Name string `bson:"name"`
	Price float64 `bson:"price"`
	Volume int `bson:"volume"`
}

func main() {
	// 设置上下文
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	// 连接到 MongoDB
	clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatal("Error connecting to MongoDB:", err)
	}
	// 选择库+ 表
	db := client.Database("testdb")
	collection := db.Collection("stocks")

	stock := Stock{
		Code: "600000",
		Name: "浦发银行",
		Price: 10.5,
		Volume: 1000000,
	}
	insertResult, err := collection.InsertOne(ctx, stock)
	if err != nil {
		log.Fatal("Error inserting document:", err)
	}
	fmt.Println("Inserted document ID:", insertResult.InsertedID)
	var result Stock
	err = collection.FindOne(ctx, bson.M{"code": "600000"}).Decode(&result)
	if err != nil {
		log.Fatal("Error finding document:", err)
	}
	fmt.Println("Found document:", result)
	// 更新数据
	update := bson.M{"$set": bson.M{"price": 11.0}}
	_, err = collection.UpdateOne(ctx, bson.M{"code": "600000"}, update)
	if err != nil {
		log.Fatal("Error updating document:", err)
	}
	fmt.Println("Updated document")
	// 删除数据
	_, err = collection.DeleteOne(ctx, bson.M{"code": "600000"})
	if err != nil {
		log.Fatal("Error deleting document:", err)
	}
	defer client.Disconnect(ctx)
}